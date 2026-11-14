/**
 * 好友图片消息被吞回归（2026-08-26 21:09 合成回归场景）
 *
 * 合成场景（conv 8000000000180018）：
 *   21:09:42 自己发图(1001827, FmUo url)
 *   21:09:48 自己发表情(1001829)
 *   21:09:50 好友发图(1001831, isHd:true 39c9 url)  ← MySQL/pageList 都在
 *   21:09:58 自己发视频失败(本地占位 TaskId=800000000000090009, mp4 url)
 * 打开会话 HTTP+本地合并后，好友 21:09:50 的图在 UI 消失/错挂到其它条目。
 */
import { expect } from 'chai'
import { mapHistoryRowToTalk } from '@/utils/mapHistoryRowToTalk'
import { mergeDedupeAndSort, insertChatSorted } from '@/utils/chatMerge'
import { prepareChatsForView } from '@/utils/prepareChatForView'
import { markLocalSendFailedInMessages } from '@/utils/localSendPreview'

const WX = '8000000000020002'
const CONV = '8000000000180018'
const SELF = '8000000000020002'
const FRIEND = '8000000000180018'

/** 合成 pageList 回归数据，不包含业务记录 */
function row(over) {
  return {
    id: 0,
    cid: 7,
    WxId: WX,
    ConvId: CONV,
    convType: 0,
    SenderId: SELF,
    ContentType: '1',
    Content: '',
    MsgId: '',
    MsgRemoteId: '',
    msgSvrId: '',
    msgTime: '',
    SenderName: '演示客服',
    RefId: '0',
    isSend: 'true',
    isRevoked: 0,
    senderAccountId: 19,
    create_time: '2026-08-26T13:09:35.000+00:00',
    senderAccountName: 'demo_agent',
    ...over
  }
}

const ROWS = [
  row({ id: 16507, ContentType: '1', Content: '合成消息正文', MsgId: '8000000000000140014', MsgRemoteId: '1001825', msgSvrId: '1001825', msgTime: '1787749673' }),
  row({
    id: 16508,
    ContentType: '2',
    Content:
      '{"isHd":false,"midSize":0,"size":232590,"thumbSize":0,"thumbUrl":"https://file.example.invalid/wework/20260824/synthetic-own-image.jpg?imageView2/1/w/200/h/200/q/90","url":"https://file.example.invalid/wework/20260824/synthetic-own-image.jpg"}',
    MsgId: '8000000000000150015',
    MsgRemoteId: '1001827',
    msgSvrId: '1001827',
    msgTime: '1787749774'
  }),
  row({
    id: 16509,
    SenderId: FRIEND,
    ContentType: '14',
    Content:
      '{"desc":"动画表情","fileId":"","groupId":"","height":240,"srcType":102,"staticUrl":"","type":2,"width":240,"aesKey":"","md5":"00000000000000000000000000000001","size":0,"thumbSize":0,"url":"https://wework.qpic.cn/wwpic3az/wwwx_00000000000000000000000000000001/0"}',
    MsgId: '8000000000000160016',
    MsgRemoteId: '1001829',
    msgSvrId: '1001829',
    msgTime: '1787749782',
    isSend: 'false',
    senderAccountId: null,
    senderAccountName: null,
    SenderName: '演示联系人'
  }),
  row({
    id: 16510,
    SenderId: FRIEND,
    ContentType: '2',
    Content:
      '{"isHd":true,"midSize":69310,"size":69310,"thumbSize":3050,"thumbUrl":"https://file.example.invalid/wework/20260826/synthetic-friend-image.jpg?imageView2/1/w/200/h/200/q/90","url":"https://file.example.invalid/wework/20260826/synthetic-friend-image.jpg"}',
    MsgId: '8000000000000170017',
    MsgRemoteId: '1001831',
    msgSvrId: '1001831',
    msgTime: '1787749788',
    isSend: 'false',
    senderAccountId: null,
    senderAccountName: null,
    SenderName: '演示联系人'
  })
]

/** 本地失败视频占位（21:09:58 发送，手机 21:10:00 回失败） */
function videoPlaceholder() {
  return {
    WxId: WX,
    ConvId: CONV,
    ContentType: 'Video',
    Content: 'https://file.example.invalid/wework/20260826/synthetic-video.mp4',
    TaskId: '800000000000090009',
    MsgId: '',
    MsgRemoteId: '',
    CreateTime: 1787749798,
    MsgTime: 1787749798,
    SenderId: WX,
    LocalSend: true,
    SenderAccountName: 'demo_agent'
  }
}

const find1831 = (list) =>
  (list || []).find((m) => String(m.MsgRemoteId) === '1001831')
const findPlaceholder = (list) =>
  (list || []).find((m) => String(m.TaskId) === '800000000000090009')

describe('好友图片消息被吞回归（合成消息序列）', () => {
  it('纯 HTTP 管线：pageList 行 → map → merge → 视图层，好友图 1001831 存活', () => {
    const talks = ROWS.map((r) => mapHistoryRowToTalk(r, WX, CONV))
    const merged = mergeDedupeAndSort([], talks)
    expect(merged, '合并后应含 4 条').to.have.lengthOf(4)
    const target = find1831(merged)
    expect(target, '好友图片消息不得被合并丢弃').to.not.be.undefined
    expect(String(target.SenderId)).to.equal(FRIEND)

    const views = prepareChatsForView(merged)
    expect(find1831(views), '视图层不得丢弃好友图片').to.not.be.undefined
  })

  it('现场序列：HTTP 加载 → 好友图(WS 追加) → 视频占位插入 → 标失败，全部存活且不串内容', () => {
    const talks = ROWS.map((r) => mapHistoryRowToTalk(r, WX, CONV))
    let list = mergeDedupeAndSort([], talks)

    // 21:09:58 视频占位（先插入再标失败）
    list = insertChatSorted(list, videoPlaceholder())
    // 21:10:00 手机回失败
    list = markLocalSendFailedInMessages(list, {
      TaskId: '800000000000090009',
      Success: false,
      ErrMsg: '发送失败'
    })

    const pic = find1831(list)
    expect(pic, '好友图片消息不得被失败占位吞并').to.not.be.undefined
    expect(
      String(pic.SenderId),
      '好友图片的 SenderId 不得被占位覆盖'
    ).to.equal(FRIEND)
    expect(
      String(pic.Content).indexOf('synthetic-friend-image') >= 0,
      '好友图片 Content 不得被视频 mp4 内容覆盖'
    ).to.equal(true)

    const failed = findPlaceholder(list)
    expect(failed, '失败视频占位保留').to.not.be.undefined
    expect(failed.Status, '占位已标失败').to.equal(5)
    expect(
      String(failed.Content).indexOf('.mp4') >= 0,
      '失败占位内容仍是视频'
    ).to.equal(true)

    // 视图层
    const views = prepareChatsForView(list)
    expect(find1831(views), '视图层好友图片仍存活').to.not.be.undefined
    expect(views.filter((m) => !!m), '视图层无空条目').to.not.include(undefined)
  })

  it('二次打开合并：本地(含失败占位+好友图) + HTTP 重拉，好友图仍是独立条目', () => {
    const talks = ROWS.map((r) => mapHistoryRowToTalk(r, WX, CONV))
    let local = mergeDedupeAndSort([], talks)
    local = insertChatSorted(local, videoPlaceholder())
    local = markLocalSendFailedInMessages(local, {
      TaskId: '800000000000090009',
      Success: false,
      ErrMsg: '发送失败'
    })

    // 重新打开会话：HTTP 再拉同一批
    const again = ROWS.map((r) => mapHistoryRowToTalk(r, WX, CONV))
    const merged = mergeDedupeAndSort(local, again)

    expect(find1831(merged), '二次合并不得吞并好友图').to.not.be.undefined
    expect(
      merged.filter((m) => String(m.MsgRemoteId) === '1001831')
    ).to.have.lengthOf(1, '好友图只保留一条')
    const pic = find1831(merged)
    expect(String(pic.SenderId)).to.equal(FRIEND)
    expect(String(pic.Content).indexOf('synthetic-friend-image') >= 0).to.equal(true)
    expect(findPlaceholder(merged), '失败占位保留').to.not.be.undefined
  })
})
