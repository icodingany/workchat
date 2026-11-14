/**
 * 前端坏味道回归契约（老程序员视角）。
 * 不测「能跑」，测「不该再犯的结构性问题」——任一断言失败 = 债务回潮或 refactor 漏改。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { expect } from 'chai'
import { normalizeChatFields, normalizeContentType, pickChatField } from '@/utils/chatMessageFields'
import { mergeDedupeAndSort } from '@/utils/chatMerge'
import { mapHistoryRowToTalk } from '@/utils/mapHistoryRowToTalk'
import { isFriendAddGreetingDigest } from '@/utils/conversationDigest'
import { prepareChatsForView, filterDuplicateFriendAddGreetings } from '@/utils/prepareChatForView'

const SHOW_CHATS = resolve(__dirname, '../../src/views/conversation/components/secondPart/ShowChats.vue')
const SHOW_CHATS_MIXIN_DIR = resolve(__dirname, '../../src/views/conversation/components/secondPart/showChatsMixin')
const FRIEND_CHAT_LIST = resolve(__dirname, '../../src/views/admin/components/FriendChatMessageList.vue')
const showChatsSrc = readFileSync(SHOW_CHATS, 'utf8')
const showChatsMixinUiSrc = readFileSync(resolve(SHOW_CHATS_MIXIN_DIR, 'methodsUi.js'), 'utf8')
const showChatsMixinComputedSrc = readFileSync(resolve(SHOW_CHATS_MIXIN_DIR, 'computed.js'), 'utf8')
const showChatsMixinIndexSrc = readFileSync(resolve(SHOW_CHATS_MIXIN_DIR, 'index.js'), 'utf8')
const friendChatListSrc = readFileSync(FRIEND_CHAT_LIST, 'utf8')

const WX = 'wx_smell_001'
const CONV = 'wxid_smell_friend'

describe('前端坏味道契约', () => {
  describe('1. ContentType 管线：归一后应是枚举名，不是裸数字', () => {
    const numericInputs = [1, 2, 3, 4, 5, 6, 8, 9, '1', '2', '6']
    for (const n of numericInputs) {
      it(`normalizeChatFields contentType=${n} → 字符串枚举名`, () => {
        const out = normalizeChatFields({
          wxId: WX,
          convId: CONV,
          contentType: n,
          content: n === 2 ? JSON.stringify({ url: 'https://cdn/a.jpg' }) : 'hello',
          msgRemoteId: 'smell-' + n
        })
        expect(out.ContentType).to.be.a('string')
        expect(String(out.ContentType)).to.not.match(/^\d+$/)
      })
    }

    it('视图层不应再依赖「枚举名 || 数字」双分支（归一后数字分支是死代码）', () => {
      const row = mapHistoryRowToTalk(
        { convId: CONV, wxId: WX, contentType: 2, content: '{"url":"https://x/a.jpg"}', msgRemoteId: 'pic1' },
        WX,
        CONV
      )
      expect(row.ContentType).to.equal('Picture')
      expect(row.ContentType).to.not.equal(2)
    })
  })

  describe('2. pickChatField 统一取字段（mapHistoryRowToTalk 无 pickFirst）', () => {
    it('contentType:null 时 pickChatField 能落到 ContentType，pickFirst 式写法会误用 null', () => {
      const row = { contentType: null, ContentType: '1', content: '正文' }
      expect(pickChatField(row, 'contentType', 'ContentType')).to.equal('1')
      // mapHistoryRowToTalk 已走 pickChatField；若有人改回 row.contentType ?? row.ContentType 会复现事故
      const talk = mapHistoryRowToTalk(row, WX, CONV)
      expect(talk.ContentType).to.equal('Text')
      expect(String(talk.Content)).to.equal('正文')
    })

    it('mapHistoryRowToTalk 不再内联 pickFirst', () => {
      const src = readFileSync(resolve(__dirname, '../../src/utils/mapHistoryRowToTalk.js'), 'utf8')
      expect(src).not.to.include('function pickFirst')
      expect(src).to.include('pickChatField')
    })
  })

  describe('3. friendAdd 过滤：merge 与 ShowChats 双保险，全部隐藏', () => {
    it('merge 与视图 filter 后无 has added', () => {
      const msgs = [
        { MsgRemoteId: '1', ContentType: 'System', Content: '<i></i> has added Alice', CreateTime: 10 },
        { MsgRemoteId: '2', ContentType: 'System', Content: '<i></i> has added Bob', CreateTime: 20 },
        { MsgRemoteId: '3', ContentType: 'Text', Content: 'hi', CreateTime: 30 }
      ]
      const merged = mergeDedupeAndSort([], msgs)
      expect(merged.filter((m) => isFriendAddGreetingDigest(m.Content))).to.have.length(0)

      const view = prepareChatsForView(merged)
      expect(view.filter((m) => isFriendAddGreetingDigest(m.Content))).to.have.length(0)
      expect(view).to.have.length(1)
      expect(view[0].Content).to.equal('hi')
    })

    it('绕过 merge 直接注入时，视图 filter 仍能挡住 has added', () => {
      const msgs = [
        { MsgRemoteId: '1', ContentType: 'System', Content: '<i></i> has added Alice', CreateTime: 10 },
        { MsgRemoteId: '2', ContentType: 'System', Content: '<i></i> has added Bob', CreateTime: 20 }
      ]
      const bypassMerge = msgs.map((x) => ({ ...normalizeChatFields(x) }))
      const withViewFilter = filterDuplicateFriendAddGreetings(bypassMerge)
      expect(withViewFilter).to.have.length(0)
    })
  })

  describe('4. decodeChat 已抽到 decodeChatHtml 模块', () => {
    it('ShowChats 委托 decodeChatHtml（via showChatsMixin/methodsUi）', () => {
      expect(showChatsSrc).to.include('ShowChatsMixin')
      expect(showChatsMixinUiSrc).to.include("from '@/utils/decodeChatHtml'")
      expect(showChatsMixinUiSrc).to.include('decodeChatHtml(chat,')
    })

    it('FriendChatMessageList 委托 decodeChatHtml，不再内联大段 switch', () => {
      expect(friendChatListSrc).to.include("from '@/utils/decodeChatHtml'")
      expect(friendChatListSrc).to.include('decodeChatHtml(chat,')
      const start = friendChatListSrc.indexOf('decodeChat(chat) {')
      const end = friendChatListSrc.indexOf('scrollToBottom() {', start)
      const body = friendChatListSrc.slice(start, end)
      expect(body).not.to.include('switch (ContentType)')
    })

    it('AutoReply.vue 委托 autoReplyPreview → decodeChatHtml', () => {
      const src = readFileSync(resolve(__dirname, '../../src/views/tools/components/AutoReply.vue'), 'utf8')
      expect(src).to.include("from '@/utils/autoReplyPreview'")
      expect(src).to.include('decodeAutoReplyHtml(row)')
      expect(src).not.to.match(/decodeChat\([\s\S]*switch \(chat\.resourceType\)/)
    })

    it('decodeChatHtml 所有分支统一写 __decodedHtml', () => {
      const src = readFileSync(resolve(__dirname, '../../src/utils/decodeChatHtml.js'), 'utf8')
      expect(src).to.include('chat.__decodedHtml = html')
      expect(src).not.to.match(/case 'File':[\s\S]*?return `/)
    })
  })

  describe('5. ShowChats 上帝组件与 computed 副作用', () => {
    it('ShowChats.vue 已拆至 mixin，行数应远低于 refactor 前 ~2500', () => {
      const lines = showChatsSrc.split('\n').length
      expect(lines).to.be.lessThan(1200)
    })

    it('chats computed 委托 prepareChatForView（在 showChatsMixin/computed.js）', () => {
      expect(showChatsMixinComputedSrc).to.include("from '@/utils/prepareChatForView'")
      expect(showChatsMixinComputedSrc).to.include('filterDuplicateFriendAddGreetings')
      expect(showChatsMixinComputedSrc).to.include('buildChatViewFinger')
    })

    it('showChatsMixin 按 kelailaichatpc 分模块（history / preview / forward / message / ui）', () => {
      expect(showChatsMixinIndexSrc).to.include('methodsHistory')
      expect(showChatsMixinIndexSrc).to.include('methodsImagePreview')
      expect(showChatsMixinIndexSrc).to.include('methodsForward')
      expect(showChatsMixinIndexSrc).to.include('methodsMessage')
      expect(showChatsMixinIndexSrc).to.include('methodsUi')
    })

    it('拆分后关键方法不得为空壳（大图 / 同步消息）', () => {
      const imageSrc = readFileSync(resolve(SHOW_CHATS_MIXIN_DIR, 'methodsImagePreview.js'), 'utf8')
      const historySrc = readFileSync(resolve(SHOW_CHATS_MIXIN_DIR, 'methodsHistory.js'), 'utf8')
      expect(imageSrc).to.match(/openPicturePreview\s*\([^)]*\)\s*\{[\s\S]*?normalizePictureUrl/)
      expect(imageSrc).to.match(/fetchOriginalImageAsync\s*\([^)]*\)\s*\{[\s\S]*?downloadFileByMsgIdTask/)
      expect(historySrc).to.match(
        /startPhoneHistorySyncPoll\s*\([^)]*\)\s*\{[\s\S]*?triggerHistoryPull/
      )
      expect(historySrc).to.include('this.$message.info')
      expect(historySrc).to.include("this.$store.dispatch('conversation/LoadChatsByHttp'")
    })

    it('单条消息渲染抽到 ChatItem.vue，ShowChats 只 v-for ChatItem', () => {
      const chatItemSrc = readFileSync(
        resolve(SHOW_CHATS_MIXIN_DIR, '../ChatItem.vue'),
        'utf8'
      )
      expect(showChatsSrc).to.include("import ChatItem from './ChatItem.vue'")
      expect(showChatsSrc).to.include(':ctx="chatItemCtx"')
      expect(showChatsMixinComputedSrc).to.include('chatItemCtx()')
      expect(chatItemSrc).to.include('decodedHtml')
      expect(chatItemSrc).to.include('props:')
    })

    it('ChatItem 模板用 bubbleClasses，不再写 ContentType === 数字', () => {
      const chatItemSrc = readFileSync(resolve(SHOW_CHATS_MIXIN_DIR, '../ChatItem.vue'), 'utf8')
      const tpl = chatItemSrc.match(/<template[^>]*>([\s\S]*?)<\/template>/)[1]
      expect(tpl).to.include('bubbleClassList')
      expect(tpl).not.to.include("chat.ContentType === 'Picture' || chat.ContentType === 2")
    })
  })

  describe('6. v-html 拼接：用户可见字段已 escapeHtml', () => {
    it('decodeChatHtml 对 jContent.title 等调用 escapeHtml', () => {
      const decodeSrc = readFileSync(resolve(__dirname, '../../src/utils/decodeChatHtml.js'), 'utf8')
      expect(decodeSrc).to.include("from '@/utils/escapeHtml'")
      expect(decodeSrc).to.match(/escapeHtml\(jContent\.title/)
    })
  })

  describe('7. normalizeContentType 应作为唯一数字→名映射入口', () => {
    it('normalizeContentType 与 CONTENT_TYPE_NAME 覆盖 WS/HTTP 常见值', () => {
      expect(normalizeContentType(1)).to.equal('Text')
      expect(normalizeContentType('2')).to.equal('Picture')
      expect(normalizeContentType('System')).to.equal('System')
    })
  })
})
