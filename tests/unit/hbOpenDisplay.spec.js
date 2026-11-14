import { expect } from 'chai'
import { mount, shallowMount } from '@vue/test-utils'
import ElementPlus from 'element-plus'

/**
 * 红包打开/领取后展示（对齐 kelailaichatpc）：
 * - 打开弹窗：红色渐变卡片 + 金色圆形「开」按钮 + 圆形关闭按钮
 * - 已领取详情：360px 卡片（发送者/祝福/N个红包共X元/领取记录），金额按分转元
 * - isHbDetailAlreadyClaimed：Records 含当前企微号或本地缓存已 opened
 */

// 直接挂 mixin 宿主组件验证逻辑与模板类名，避开 ShowChats 全量依赖
import ShowChatsMixin from '@/views/conversation/components/secondPart/showChatsMixin/index.js'

const hbChat = {
  WxId: '1001',
  ConvId: '2002',
  MsgRemoteId: '3003',
  ContentType: 'LuckyMoney',
  Content: '{"Key":"hb_key_1","Title":"恭喜发财","InvalidTime":9999999999}',
  SenderId: '9999',
  _hbType: 'redpacket',
  _jContent: { Key: 'hb_key_1', Title: '恭喜发财' }
}

function createStore({ luckMoneyMap = {}, contacts = [], hbDetail = {}, currentWeChatId = '1001', currentFriend = null } = {}) {
  const contactsMap = {}
  contacts.forEach((c) => {
    contactsMap[c.RemoteId] = c
  })
  let state = {
    conversation: {
      currentChats: { Messages: [] },
      hbDetailVisible: false,
      hbDetail,
      currentWechat: null,
      currentFriend,
      currentFriendId: currentFriend && currentFriend.RemoteId,
      currentWeChatId,
      contacts: [],
      customers: [],
      selectMode: false,
      selectedMsgs: [],
      translations: {},
      bigImageMap: {}
    },
    nedb: { luckMoneyMap, refundedTransferKeys: {} }
  }
  const getters = {
    'conversation/hbDetail': () => state.conversation.hbDetail,
    'conversation/hbDetailVisible': () => state.conversation.hbDetailVisible,
    'conversation/currentChats': () => state.conversation.currentChats,
    'conversation/currentFriend': () => state.conversation.currentFriend,
    'conversation/currentFriendId': () => state.conversation.currentFriendId,
    'conversation/currentWeChatId': () => state.conversation.currentWeChatId,
    'conversation/contactsMap': () => contactsMap,
    'conversation/currentContacts': () => contacts.filter((c) => c._kind === 'contact'),
    'conversation/currentCustomers': () => contacts.filter((c) => c._kind === 'customer'),
    'conversation/supportsMergeForward': () => false,
    'conversation/selectMode': () => false,
    'conversation/selectedMsgs': () => [],
    'conversation/translations': () => ({}),
    'conversation/bigImageMap': () => ({}),
    'conversation/currentConvs': () => [],
    'conversation/currentWechat': () => null,
    'conversation/currentCustomers': () => [],
    'conversation/currentContacts': () => [],
    'nedb/luckMoneyMap': () => state.nedb.luckMoneyMap,
    'nedb/refundedTransferKeys': () => state.nedb.refundedTransferKeys,
    currentMode: () => 'web',
    isDesktop: () => false,
    currentUser: () => ({}),
    adminInfo: () => ({})
  }
  // mapGetters 通过 store.getters[name] 解析（use 前需注册）
  const resolved = {}
  const store = {
    state,
    commit(type, payload) {
      if (type === 'conversation/SET_HB_DETAIL') state.conversation.hbDetail = payload
      if (type === 'conversation/SET_HB_DETAIL_VISIBLE') state.conversation.hbDetailVisible = payload
    },
    dispatch() {
      return Promise.resolve()
    },
    subscribe() {
      return () => {}
    }
  }
  Object.defineProperty(store, 'getters', {
    get() {
      const g = {}
      for (const name in getters) g[name] = getters[name]()
      return g
    }
  })
  return store
}

const Dummy = {
  mixins: [ShowChatsMixin],
  template: '<div />'
}

function mountWith(store) {
  return mount(Dummy, {
    global: {
      plugins: [
        (app) => {
          app.config.globalProperties.$store = store
          app.config.globalProperties.$filters = {
            hbUrlFilter: (v) => v || ''
          }
        }
      ]
    }
  })
}

describe('红包打开/领取后展示（hbAction/hbDetail）', () => {
  it('hbAmountYuan 分转元保留两位', () => {
    const store = createStore()
    const wrapper = mountWith(store)
    expect(wrapper.vm.hbAmountYuan(100)).to.equal('1.00')
    expect(wrapper.vm.hbAmountYuan(12345)).to.equal('123.45')
    expect(wrapper.vm.hbAmountYuan(0)).to.equal('0.00')
    expect(wrapper.vm.hbAmountYuan(null)).to.equal('0.00')
  })

  it('hbRecordTime 兼容秒/毫秒时间戳，输出 MM月DD日 HH:mm', () => {
    const store = createStore()
    const wrapper = mountWith(store)
    const d = new Date(2026, 7, 25, 9, 5)
    const ms = d.getTime()
    expect(wrapper.vm.hbRecordTime(ms)).to.equal('08月25日 09:05')
    expect(wrapper.vm.hbRecordTime(Math.floor(ms / 1000))).to.equal('08月25日 09:05')
    expect(wrapper.vm.hbRecordTime('abc')).to.equal('-')
    expect(wrapper.vm.hbRecordTime(null)).to.equal('-')
  })

  it('hbRecordName / getRecordAvatar 命中 contactsMap', () => {
    const store = createStore({
      contacts: [
        { RemoteId: 'u1', Name: '张三', Avatar: 'http://a/1.png' },
        { RemoteId: 'u2', Name: '李四', Avatar: '' }
      ]
    })
    const wrapper = mountWith(store)
    expect(wrapper.vm.hbRecordName({ UserName: 'u1' })).to.equal('张三')
    expect(wrapper.vm.hbRecordName({ UserName: 'unknown' })).to.equal('unknown')
    expect(wrapper.vm.getRecordAvatar('u1')).to.equal('http://a/1.png')
    expect(wrapper.vm.getRecordAvatar('unknown')).to.equal('')
  })

  it('isHbDetailAlreadyClaimed：Records 含当前企微号 → 已领取', () => {
    const store = createStore({
      hbDetail: { Records: [{ UserName: '1001', Amount: 88 }] }
    })
    const wrapper = mountWith(store)
    wrapper.setData
    wrapper.vm.hb2detail = { ...hbChat }
    expect(wrapper.vm.isHbDetailAlreadyClaimed).to.equal(true)
  })

  it('isHbDetailAlreadyClaimed：本地缓存 opened → 已领取', () => {
    const store = createStore({
      luckMoneyMap: { msgkey_hb_key_1: { opened: true, Amount: 88, MsgKey: 'hb_key_1' } }
    })
    const wrapper = mountWith(store)
    wrapper.vm.hb2detail = { ...hbChat }
    expect(wrapper.vm.isHbDetailAlreadyClaimed).to.equal(true)
  })

  it('isHbDetailAlreadyClaimed：无记录且无缓存 → 未领取', () => {
    const store = createStore()
    const wrapper = mountWith(store)
    wrapper.vm.hb2detail = { ...hbChat }
    expect(wrapper.vm.isHbDetailAlreadyClaimed).to.equal(false)
  })

  it('hbSenderName 单聊取当前联系人 Name', () => {
    const store = createStore({ currentFriend: { RemoteId: '9999', Name: '客户A', Avatar: 'http://a/9.png' } })
    const wrapper = mountWith(store)
    wrapper.vm.hb2detail = { ...hbChat }
    expect(wrapper.vm.hbSenderName).to.equal('客户A')
    expect(wrapper.vm.hbSenderAvatar).to.equal('http://a/9.png')
  })

  it('hbSenderName 群聊回退到消息发送者', () => {
    const store = createStore({
      currentFriend: { RemoteId: 'g1', Members: [], Name: '群聊' },
      contacts: [{ RemoteId: '9999', Name: '群成员B' }]
    })
    const wrapper = mountWith(store)
    wrapper.vm.hb2detail = { ...hbChat }
    expect(wrapper.vm.hbSenderName).to.equal('群成员B')
  })
})
