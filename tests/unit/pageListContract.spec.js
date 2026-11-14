/**
 * pageList 契约：fixture 行 → mapHistoryRowToTalk → 视图可读字段。
 * 锁定生产常见混用形状（contentType:null + ContentType:'1' 等）。
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect } from 'chai'
import { mapHistoryRowToTalk } from '@/utils/mapHistoryRowToTalk'
import { normalizeChatFields } from '@/utils/chatMessageFields'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, '../fixtures/pageList')

const WX = 'wx_contract_001'
const CONV = 'wxid_friend_contract'

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'))
}

/** 复刻 ShowChats chats() 的 normalize 一步 */
function viewShape(talk) {
  return normalizeChatFields(talk)
}

describe('pageList 契约 fixture', () => {
  it('mixed-null-contentType：contentType:null 不挡 ContentType，映射为 Text', () => {
    const res = loadFixture('mixed-null-contentType.json')
    const rows = res.data.rows
    const talks = rows.map((row) => mapHistoryRowToTalk(row, WX, CONV))
    expect(talks).to.have.lengthOf(2)

    const nullTypeRow = talks[0]
    expect(nullTypeRow.ContentType).to.equal('Text')
    expect(String(nullTypeRow.Content)).to.include('contentType 为 null')
    expect(String(nullTypeRow.Content)).to.not.include('undefined')

    const snakeRow = talks[1]
    expect(snakeRow.ContentType).to.equal('Text')
    expect(String(snakeRow.Content)).to.equal('标准 snake_case 文本')
  })

  it('pascal-case-dual-fields：PascalCase 行完整映射', () => {
    const res = loadFixture('pascal-case-dual-fields.json')
    const talk = mapHistoryRowToTalk(res.data.rows[0], WX, CONV)
    expect(talk.ContentType).to.equal('Text')
    expect(String(talk.Content)).to.equal('PascalCase 正文')
    expect(talk.WxId).to.equal(WX)
    expect(talk.ConvId).to.equal(CONV)
  })

  it('全 fixture 经视图 normalize 后 ContentType 非空、文本无 undefined', () => {
    const files = ['mixed-null-contentType.json', 'pascal-case-dual-fields.json']
    for (const file of files) {
      const res = loadFixture(file)
      const rows = res.data.rows || []
      for (const row of rows) {
        const v = viewShape(mapHistoryRowToTalk(row, WX, CONV))
        expect(v.ContentType, `${file} ContentType`).to.be.a('string').and.not.equal('')
        if (v.ContentType === 'Text') {
          expect(String(v.Content), `${file} Content`).to.not.include('undefined')
          expect(String(v.Content).trim(), `${file} 文本非空`).to.not.equal('')
        }
      }
    }
  })
})
