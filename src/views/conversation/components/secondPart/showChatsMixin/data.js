/** ShowChats 本地 state */
export default {
  data() {
    return {
      revokeMap: ['Text', 'NameCard', 'Picture', 'Voice', 'Video', 'File', 'Link', 'WeApp'], // 符合的才显示撤回按钮
      bigImageUrl: '', // 大图预览地址（原图优先；无原图时用缩略图兜底立即打开，后台升原图）
      bigImagePreviewVisible: false, // 大图预览是否打开
      bigImagePreviewKey: 0, // 切换图片时递增，强制重挂 viewer 重置缩放/位置
      bigImagePreviewWaitingKey: '', // 正在后台拉原图的消息 key（MsgId），用于回包后自动换图
      bigImagePreviewWaitingAltKey: '', // MsgId / MsgRemoteId 双 key 兜底
      waitingMsgId: '', // 等待原图回包的消息 key
      waitingContentType: null,
      bigImagePreviewOriginalLoadingTimer: null,
      // 含视频号：proto ShiPinHao=25（勿与 kelailaichatpc 的 24 混淆）
      collectionType: [
        6,
        13,
        4,
        14,
        25,
        'Link',
        'WeApp',
        'Text',
        'Picture',
        'Video',
        'Emoji',
        'ShiPinHao'
      ],
      knicking: false, // 正在踢人
      hb2detail: {}, // 红包/转账弹窗详情
      hbActionDialogVisible: false,
      msgContextMenuVisible: false,
      msgContextMenuX: 0,
      msgContextMenuY: 0,
      msgContextMenuItems: [],
      msgContextChat: null,
      forwardDialogVisible: false,
      forwardChats: [],
      forwardMerge: false,
      forwardActiveTab: 'chat',
      forwardSelectionByTab: { chat: [], friends: [], chatrooms: [] },
      forwardSearchText: '',
      historyLoading: false, // 上滑游标加载锁
      _openSessionLoadGen: 0,
      _openSessionDebounceTimer: null,
      _historyPollTimer: null,
      _historyRetryTimer: null,
      _coverageFillTimer: null,
      _coverageFillLastAt: 0,
      _coverageFillSessionKey: '',
      _chatViewCache: null,
      _chatViewSessionKey: '',
      accountList: []
    }
  }
}
