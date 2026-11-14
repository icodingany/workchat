/**
 * Dexie 适配层：IndexedDB 实现 NeDB 风格的 find/findOne/insert/update/remove API，
 * store 模块无需改动调用方式。
 */
import { workchatDB as db } from '@/db/dexie/database'
import { toPlainForIdb } from '@/utils/historyChatLocalPersist'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11)
}

function asPlainDoc(doc) {
  const plain = toPlainForIdb(doc)
  return plain && typeof plain === 'object' ? plain : {}
}

function normalizeQueryId(id) {
  if (id === null || id === undefined || id === '') return ''
  return String(id)
}

const LOOSE_ID_FIELDS = new Set(['WxId', 'RemoteId', 'WeChatId', 'ConvId', 'ChatRoomId'])

function matchDoc(doc, query) {
  if (!query || typeof query !== 'object') return true
  for (const key of Object.keys(query)) {
    const q = query[key]
    const val = doc[key] !== undefined ? doc[key] : doc[key === 'taskId' ? 'TaskId' : null]
    if (key === 'taskId' && doc.TaskId !== undefined) {
      if (doc.TaskId !== q) return false
      continue
    }
    if (q && typeof q === 'object' && q.$regex) {
      const str = val != null ? String(val) : ''
      if (!q.$regex.test(str)) return false
      continue
    }
    if (LOOSE_ID_FIELDS.has(key)) {
      if (normalizeQueryId(val) !== normalizeQueryId(q)) return false
      continue
    }
    if (val !== q) return false
  }
  return true
}

function applyUpdate(doc, update) {
  if (!update || typeof update !== 'object') return
  if (update.$set) {
    for (const k of Object.keys(update.$set)) {
      doc[k] = update.$set[k]
    }
  } else {
    const id = doc._id
    Object.keys(doc).forEach((k) => {
      delete doc[k]
    })
    Object.assign(doc, update)
    doc._id = id
  }
}

const INDEXED_FIELDS = {
  contacts: ['WxId'],
  departments: ['WxId'],
  customers: ['WxId', 'RemoteId'],
  corporations: ['WxId'],
  labels: ['WeChatId'],
  addCustomerFromSearchTask: ['TaskId', 'userId', 'WxId'],
  chatRoomTask: ['TaskId'],
  chatRoomConfig: ['WeChatId', 'ChatRoomId'],
  memoTask: ['TaskId'],
  luckMoney: ['userId', 'WeChatId', 'MsgKey'],
  groupSendTask: ['TaskId', 'userId', 'WeChatId']
}

function getIndexKeyForQuery(tableName, query) {
  if (!query || typeof query !== 'object') return null
  const keys = Object.keys(query)
  if (keys.length !== 1) return null
  const key = keys[0]
  const val = query[key]
  if (val != null && typeof val === 'object' && val.$regex) return null
  const fields = INDEXED_FIELDS[tableName]
  if (fields && fields.includes(key)) return key
  return null
}

async function filterTable(table, tableName, query) {
  const indexKey = getIndexKeyForQuery(tableName, query)
  if (indexKey && LOOSE_ID_FIELDS.has(indexKey)) {
    const all = await table.toArray()
    return query ? all.filter((doc) => matchDoc(doc, query)) : all
  }
  if (indexKey) {
    const value = query[indexKey]
    const docs = await table.where(indexKey).equals(value).toArray()
    return docs.filter((doc) => matchDoc(doc, query))
  }
  const all = await table.toArray()
  return query ? all.filter((doc) => matchDoc(doc, query)) : all
}

async function findOneWithIndex(table, tableName, query) {
  const indexKey = getIndexKeyForQuery(tableName, query)
  if (indexKey) {
    const value = query[indexKey]
    const doc = await table.where(indexKey).equals(value).first()
    return doc && matchDoc(doc, query) ? doc : null
  }
  const docs = await filterTable(table, tableName, query)
  return docs.length ? docs[0] : null
}

function createCursor(tableName, query) {
  const table = db[tableName]
  return {
    _query: query,
    _sort: null,
    _limit: null,
    sort(spec) {
      this._sort = spec
      return this
    },
    limit(n) {
      this._limit = n
      return this
    },
    exec(cb) {
      filterTable(table, tableName, this._query)
        .then((docs) => {
          if (this._sort && Object.keys(this._sort).length) {
            const key = Object.keys(this._sort)[0]
            const desc = this._sort[key] === -1
            docs.sort((a, b) => {
              const va = a[key]
              const vb = b[key]
              if (va < vb) return desc ? 1 : -1
              if (va > vb) return desc ? -1 : 1
              return 0
            })
          }
          if (this._limit != null) docs = docs.slice(0, this._limit)
          if (cb) cb(null, docs)
        })
        .catch((err) => cb && cb(err, null))
    }
  }
}

function createCollection(tableName) {
  const table = db[tableName]
  return {
    find(query, cb) {
      if (typeof query === 'function') {
        cb = query
        query = {}
      }
      if (typeof cb === 'function') {
        filterTable(table, tableName, query)
          .then((docs) => cb(null, docs))
          .catch((err) => cb(err, null))
        return
      }
      return createCursor(tableName, query)
    },
    findOne(query, cb) {
      findOneWithIndex(table, tableName, query)
        .then((doc) => cb(null, doc))
        .catch((err) => cb(err, null))
    },
    insert(docOrArray, cb) {
      const isArray = Array.isArray(docOrArray)
      const items = isArray ? docOrArray : [docOrArray]
      const toInsert = items.map((doc) => {
        const d = asPlainDoc(doc)
        if (!d._id) d._id = generateId()
        return d
      })
      table
        .bulkAdd(toInsert)
        .then(() => {
          if (cb) cb(null, isArray ? toInsert : toInsert[0])
        })
        .catch((err) => {
          if (cb) cb(err, null)
        })
    },
    update(query, updateOrDoc, options, cb) {
      if (typeof options === 'function') {
        cb = options
        options = {}
      }
      options = options || {}
      const plainUpdate = asPlainDoc(updateOrDoc)
      const isModifier = plainUpdate && plainUpdate.$set
      filterTable(table, tableName, query)
        .then((docs) => {
          if (docs.length === 0 && options.upsert) {
            const newDoc = isModifier
              ? asPlainDoc({ ...query, ...plainUpdate.$set })
              : asPlainDoc(plainUpdate)
            if (!newDoc._id) newDoc._id = generateId()
            return table.add(newDoc).then(() => cb && cb(null, 1))
          }
          if (docs.length === 0) return cb && cb(null, 0)
          const multi = options.multi !== false
          const toUpdate = multi ? docs : docs.slice(0, 1)
          const updates = toUpdate.map((doc) => {
            const next = asPlainDoc(doc)
            applyUpdate(next, plainUpdate)
            return next
          })
          return Promise.all(updates.map((doc) => table.put(doc))).then(() => cb && cb(null, updates.length))
        })
        .catch((err) => cb && cb(err, 0))
    },
    remove(query, options, cb) {
      if (typeof options === 'function') {
        cb = options
        options = {}
      }
      options = options || {}
      filterTable(table, tableName, query)
        .then((docs) => {
          const toRemove = options.multi !== false ? docs : docs.slice(0, 1)
          const keys = toRemove.map((d) => d._id)
          return table.bulkDelete(keys).then(() => cb && cb(null, toRemove.length))
        })
        .catch((err) => cb && cb(err, 0))
    }
  }
}

const tableNames = [
  'contacts',
  'departments',
  'customers',
  'corporations',
  'labels',
  'addCustomerFromSearchTask',
  'chatRoomTask',
  'chatRoomConfig',
  'memoTask',
  'luckMoney',
  'groupSendTask'
]

const adapter = {}
tableNames.forEach((name) => {
  adapter[name] = createCollection(name)
})

export default adapter
