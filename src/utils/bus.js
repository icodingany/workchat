/**
 * 全局事件总线（Vue3 mitt + Vue2 风格 $on/$off/$emit 兼容层）
 */
import mitt from 'mitt'

const emitter = mitt()
const handlerMap = new WeakMap()

function toHandler(fn) {
  let wrapped = handlerMap.get(fn)
  if (!wrapped) {
    wrapped = (payload) => {
      if (Array.isArray(payload)) {
        fn(...payload)
      } else {
        fn(payload)
      }
    }
    handlerMap.set(fn, wrapped)
  }
  return wrapped
}

function eachType(type, fn) {
  if (Array.isArray(type)) {
    type.forEach(fn)
  } else {
    fn(type)
  }
}

const bus = {
  on: emitter.on.bind(emitter),
  off: emitter.off.bind(emitter),
  emit: emitter.emit.bind(emitter),

  $on(type, fn) {
    eachType(type, (t) => emitter.on(t, toHandler(fn)))
    return bus
  },

  $once(type, fn) {
    const onceFn = (...args) => {
      bus.$off(type, onceFn)
      fn(...args)
    }
    return bus.$on(type, onceFn)
  },

  $off(type, fn) {
    if (type === undefined || type === null) {
      emitter.all.clear()
      return bus
    }
    eachType(type, (t) => {
      if (fn === undefined) {
        emitter.off(t)
      } else {
        emitter.off(t, toHandler(fn))
      }
    })
    return bus
  },

  $emit(type, ...args) {
    emitter.emit(type, args)
    return bus
  }
}

export default bus
