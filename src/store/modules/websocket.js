/**
 * Vuex WebSocket 模块
 * <p>
 * 管理 WebSocket 相关的状态和操作，包括：
 * <ul>
 *   <li>登录状态管理（loginLoading）</li>
 *   <li>发送消息到 WebSocket 服务器</li>
 *   <li>各种 SDK 请求的 action 封装</li>
 * </ul>
 * <p>
 * <b>模块结构：</b>
 * <pre>
 * - state：登录 loading 状态
 * - getters：获取状态
 * - actions：SDK 请求封装（微信列表、群发、加好友等）
 * - mutations：发送消息、更新状态
 * </pre>
 * <p>
 * <b>主要功能分类：</b>
 * <table>
 *   <tr><th>分类</th><th>Actions</th></tr>
 *   <tr><td>认证</td><td>GetWeChatsReq, AccountLogoutNotice</td></tr>
 *   <tr><td>好友管理</td><td>PullFriendAddReqListTask, AcceptFriendAddRequestTask</td></tr>
 *   <tr><td>清理僵尸粉</td><td>PostFriendDetectTask, PostStopFriendDetectTask</td></tr>
 *   <tr><td>群发</td><td>WeChatGroupSendTask</td></tr>
 *   <tr><td>会话</td><td>TriggerMessageReadTask, GetCommonTerms</td></tr>
 *   <tr><td>群聊</td><td>RequestChatRoomInfoTask, TriggerChatroomPushTask</td></tr>
 *   <tr><td>备注</td><td>ModifyFriendMemoTask</td></tr>
 *   <tr><td>二维码</td><td>PullChatRoomQrCodeTask</td></tr>
 *   <tr><td>群成员</td><td>AddFriendInChatRoomTask</td></tr>
 *   <tr><td>红包/转账</td><td>SendLuckyMoneyTask, RemittanceTask, TakeLuckyMoneyTask, QueryHbDetailTask</td></tr>
 *   <tr><td>删除好友</td><td>DeleteFriendTask</td></tr>
 *   <tr><td>加群</td><td>AgreeJoinChatRoomTask</td></tr>
 *   <tr><td>公众号</td><td>TriggerBizContactPushTask</td></tr>
 * </table>
 */
import base64 from '@/utils/base64.js'
import { sendSock } from '../../websocket/websocket'
import { generateTaskId } from '@/utils/common'

// state
const state = {
    /** 登录页面 loading 开关 */
    loginLoading: false
}

// getters
const getters = {
    /** 获取登录 loading 状态 */
    loginLoading: (state) => state.loginLoading
}

// actions
const actions = {
    /**
     * =========================================================================
     * 认证相关
     * =========================================================================
     */

    /**
     * 从 SDK 获取微信列表
     * <p>
     * 请求服务器获取当前用户绑定的所有微信账号。
     * <p>
     * <b>请求消息：</b> GetWeChatsReq
     * <b>响应消息：</b> GetWeChatsResp → store.commit('conversation/SET_WECHATS')
     */
    GetWeChatsReq({ rootGetters, rootState, commit }) {
        const user = rootGetters.currentUser || {}
        const admin = rootGetters.adminInfo || rootState.adminInfo || {}
        // 后端按 AccountInfo.id 查库；UnionId 来自 DeviceAuth Extra，偶发缺失时需回退 HTTP 登录的 adminInfo.id
        const rawId = user.UnionId ?? user.unionId ?? admin.id ?? admin.Id
        const accountId = Number(rawId)
        if (!Number.isFinite(accountId) || accountId <= 0) {
            console.warn('[GetWeChatsReq] 跳过：缺少有效账号 id', { rawId })
            return
        }
        const msg = {
            MsgType: 'GetWeChatsReq',
            Content: {
                AccountType: user.AccountType,
                id: accountId
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * 告诉服务器退出登录
     * <p>
     * 通知服务器用户主动退出登录，清理服务端会话。
     * <p>
     * <b>请求消息：</b> AccountLogoutNotice
     * <b>响应消息：</b> DeviceExitNotice
     */
    AccountLogoutNotice({ rootGetters, commit }) {
        let msg = {
            Id: 3054,
            MsgType: 'AccountLogoutNotice',
            Content: {
                id: Number(rootGetters.currentUser.UnionId)
            },
            AccessToken: rootGetters.webSocketToken
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * =========================================================================
     * wxtools 页面相关的 SDK
     * =========================================================================
     */

    /**
     * SDK 获取好友申请列表
     * <p>
     * 获取指定微信账号收到的好友申请记录。
     * <p>
     * <b>请求消息：</b> PullFriendAddReqListTask
     * <b>响应消息：</b> FriendAddReqListNotice
     *
     * @param {Object} context Vuex context
     * @param {String} wechatId 微信 ID
     */
    PullFriendAddReqListTask({ commit }, wechatId) {
        let content = {
            WeChatId: wechatId,         // 所属微信
            StartTime: 0,              // 毫秒，0 则全部
            OnlyNew: false,            // 只获取未读的请求
            GetAll: true               // 获取所有的加好友请求信息，包括已经添加的
        }
        let msg = { MsgType: 'PullFriendAddReqListTask', Content: content }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 接受好友请求
     * <p>
     * 处理好友申请：0=忽略，1=接受，2=拒绝。
     * <p>
     * <b>请求消息：</b> AcceptFriendAddRequestTask
     * <b>响应消息：</b> FriendAddNotice
     *
     * @param {Object} context Vuex context
     * @param {Object} row 好友申请记录
     */
    AcceptFriendAddRequestTask({ rootGetters, commit }, row) {
        let wechatId = rootGetters['conversation/currentWeChatId']
        let msg = {
            MsgType: 'AcceptFriendAddRequestTask',
            Content: {
                WeChatId: wechatId,        // 商家个人微信内部全局唯一识别码
                FriendId: row.FriendId,   // 请求的好友微信内部全局唯一识别码
                Operation: 1,             // 处理结果 0忽略 1接受 2拒绝
                Remark: row.Remark || ''  // 其他备注信息
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 清理僵尸粉
     * <p>
     * 检测并删除长时间无互动的好友（僵尸粉）。
     * <p>
     * <b>请求消息：</b> PostFriendDetectTask
     * <b>响应消息：</b> PostFriendDetectCountNotice
     *
     * @param {Object} context Vuex context
     * @param {Object} clearForm 清理配置
     * @param {String} clearForm.wechatId 微信 ID
     * @param {Boolean} clearForm.delete 是否删除检测到的僵尸粉
     * @param {Number} clearForm.time 跳过多少小时内有互动的好友
     * @param {Boolean} clearForm.circle 是否检测朋友圈互动
     */
    PostFriendDetectTask({ rootGetters, dispatch, commit }, clearForm) {
        let content = {
            WeChatId: clearForm.wechatId,                    // 微信id
            TaskId: generateTaskId().toString(),             // 清粉任务ID
            OnlyCheck: !clearForm.delete,                    // false 检测到立即删除，true 不删除
            SkipHour: clearForm.time,                        // 跳过多少小时内有互动的好友
            Mode: clearForm.circle ? 6 : 1                  // 1不检测朋友圈 6检测朋友圈
        }
        let msg = {
            MsgType: 'PostFriendDetectTask',
            Content: content
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 停止清理僵尸粉
     * <p>
     * <b>请求消息：</b> PostStopFriendDetectTask
     * <b>响应消息：</b> TaskResultNotice
     *
     * @param {Object} context Vuex context
     * @param {String} wechatId 微信 ID
     */
    PostStopFriendDetectTask({ dispatch, commit }, wechatId) {
        let content = {
            WeChatId: wechatId,                 // 微信id
            TaskId: generateTaskId().toString()  // 清粉任务ID
        }
        let msg = {
            MsgType: 'PostStopFriendDetectTask',
            Content: content
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * =========================================================================
     * 群发页面相关的 SDK
     * =========================================================================
     */

    /**
     * SDK 群发助手
     * <p>
     * 向多个好友批量发送消息。
     * <p>
     * <b>请求消息：</b> WeChatGroupSendTask
     * <b>响应消息：</b> TaskResultNotice
     *
     * @param {Object} context Vuex context
     * @param {Object} message 群发配置
     * @param {Array} message.FriendIds 目标好友 ID 列表
     * @param {Number} message.ContentType 内容类型
     * @param {String} message.Content 文字内容或图片列表
     * @param {String} message.WeChatId 微信号 ID
     */
    WeChatGroupSendTask({ dispatch, commit }, message) {
        let content = {
            TaskId: generateTaskId().toString(),  // 任务id
            FriendIds: message.FriendIds,        // 目标人群id列表
            ContentType: message.ContentType,    // 内容类型
            Content: message.Content,             // 文字内容 或 图片列表
            WeChatId: message.WeChatId            // 微信号id
        }
        let msg = { MsgType: 'WeChatGroupSendTask', Content: content }
        commit('SEND_SOCK', msg)

        // 任务保存到nedb数据库
        let doc = {}
        for (const key in content) {
            if (content.hasOwnProperty(key)) {
                doc[key] = content[key]
            }
        }
        doc.MsgType = 'WeChatGroupSendTask'
        dispatch('groupSend/AddGroupSendTask2Nedb', doc, { root: true })
    },

    /**
     * =========================================================================
     * conversation 页面相关的 SDK
     * =========================================================================
     */

    /**
     * SDK 设置消息为已读
     * <p>
     * 标记指定会话的所有消息为已读状态。
     * <p>
     * <b>请求消息：</b> TriggerMessageReadTask
     *
     * @param {Object} context Vuex context
     * @param {Object} message 会话信息
     */
    TriggerMessageReadTask({ commit }, message) {
        const convId = message.Id != null ? message.Id : message.ConvId
        const wxId = message.WxId
        // ConvId 为会话 LocalId(int64)，空串会导致服务端 JsonFormat 解码失败弹「解码失败」
        if (!wxId || convId == null || convId === '') {
            return
        }
        let msg = {
            MsgType: 'TriggerMessageReadTask',
            Content: {
                WxId: wxId,
                // 会话 LocalId：保持字符串，避免 int64 经 Number 丢精度
                ConvId: String(convId)
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * Server 获取公共话术
     * <p>
     * 获取当前用户的公共话术库。
     * <p>
     * <b>请求消息：</b> GetCommonTerms
     * <b>响应消息：</b> GetCommonTermsResp
     */
    GetCommonTerms({ rootGetters, commit }) {
        let uionId = Number(rootGetters.currentUser.UnionId)
        if (uionId) {
            let msg = {
                MsgType: 'GetCommonTerms',
                Content: { id: uionId, name: 'pc' }
            }
            commit('SEND_SOCK', msg)
        }
    },

    /**
     * =========================================================================
     * 其他 SDK 功能
     * =========================================================================
     */

    /**
     * SDK 获取指定群聊的详情
     * <p>
     * 获取群聊信息和群成员列表。
     * <p>
     * <b>请求消息：</b> RequestChatRoomInfoTask
     * <b>响应消息：</b> ChatRoomAddNotice, ChatRoomMembersNotice
     */
    RequestChatRoomInfoTask({ commit }, message) {
        let msg = {
            MsgType: 'RequestChatRoomInfoTask',
            Content: {
                WeChatId: message.wechatId,
                ChatRoomId: message.friendId,
                Flag: 1    // Flag=1:推送成员信息（ChatRoomMembersNotice)
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 推送群聊列表和陌生人列表
     * <p>
     * <b>请求消息：</b> TriggerChatroomPushTask
     * <b>响应消息：</b> ChatroomPushNotice, ChatRoomMembersNotice
     */
    TriggerChatroomPushTask({ commit }, wechatId) {
        let msg = {
            MsgType: 'TriggerChatroomPushTask',
            Content: {
                WeChatId: wechatId,    // 商家所属微信号
                Flag: 1               // Flag = 1:不推送成员信息
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 修改备注信息
     * <p>
     * 修改好友备注名称。
     * <p>
     * <b>请求消息：</b> ModifyFriendMemoTask
     * <b>响应消息：</b> TaskResultNotice
     */
    ModifyFriendMemoTask({ commit, dispatch }, content) {
        content.TaskId = generateTaskId().toString()
        let msg = {
            MsgType: 'ModifyFriendMemoTask',
            Content: content
        }
        commit('SEND_SOCK', msg)
        // 操作保存本地nedb memoTask
        dispatch('nedb/AddMemoTask', content, { root: true })
    },

    /**
     * SDK 获取群二维码
     * <p>
     * <b>请求消息：</b> PullChatRoomQrCodeTask
     * <b>响应消息：</b> PullChatRoomQrCodeTaskResultNotice
     */
    PullChatRoomQrCodeTask({ commit }, message) {
        let msg = {
            MsgType: 'PullChatRoomQrCodeTask',
            Content: {
                WeChatId: message.WeChatId,      // 商家所属微信号
                ChatRoomId: message.UserName,    // 群聊id
                taskId: generateTaskId().toString()
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 添加群成员到通讯录
     * <p>
     * 从群聊中添加好友。
     * <p>
     * <b>请求消息：</b> AddFriendInChatRoomTask
     * <b>响应消息：</b> TaskResultNotice
     */
    AddFriendInChatRoomTask({ commit, dispatch }, message) {
        let msg = {
            MsgType: 'AddFriendInChatRoomTask',
            Content: {
                WeChatId: message.WeChatId,    // 商家个人微信内部全局唯一识别码
                ChatroomId: message.ChatroomId,// 所在的群聊id
                FriendId: message.FriendId,    // 请求加好友微信内部全局唯一识别码
                Message: message.Message,      // 招呼语
                Remark: message.Remark,        // 备注信息
                TaskId: generateTaskId().toString()  // 任务Id
            }
        }
        commit('SEND_SOCK', msg)
        let doc = msg.Content
        // 操作保存本地nedb chatRoomTask
        dispatch('nedb/AddChatRoomTask', doc, { root: true })
    },

    /**
     * SDK 发红包
     * <p>
     * 向好友发送红包。
     * <p>
     * <b>请求消息：</b> SendLuckyMoneyTask
     * <b>响应消息：</b> TaskResultNotice
     */
    SendLuckyMoneyTask({ commit, dispatch }, message) {
        let sendTime = new Date().getTime()
        let taskId = sendTime * 10000 + Math.random() * 10000
        let content = {
            WeChatId: message.WeChatId,    // 微信唯一Id
            FriendId: message.FriendId,    // 聊天好友微信唯一id
            Money: message.Money,          // 钱数，单位：分，最多20000
            Number: message.Number,        // 红包个数，缺省1个
            Passwd: message.Passwd,        // 密码，6位，纯数字
            Wish: message.Wish,            // 祝福语
            TaskId: taskId                 // 任务id
        }
        let msg = {
            MsgType: 'SendLuckyMoneyTask',
            Content: content
        }
        commit('SEND_SOCK', msg)

        // 消息保存本地nedb chats
        let doc = {}
        // 按收到的红包格式创建一个本地消息
        let redContent = {
            Title: message.Wish,
            Key: '',
            InvalidTime: ''
        }
        redContent.Money = message.Money
        doc.Content = base64.encode(JSON.stringify(redContent))
        doc.ContentType = 'LuckyMoney'
        doc.FriendId = message.FriendId
        doc.WeChatId = message.WeChatId
        doc.MsgId = taskId.toString()
        doc.CreateTime = sendTime.toString()
        doc.IsSend = true
    },

    /**
     * SDK 转账
     * <p>
     * 向好友转账。
     * <p>
     * <b>请求消息：</b> RemittanceTask
     * <b>响应消息：</b> TaskResultNotice
     */
    RemittanceTask({ commit, dispatch }, message) {
        let sendTime = new Date().getTime()
        let content = {
            WeChatId: message.WeChatId,    // 微信唯一Id
            FriendId: message.FriendId,    // 聊天好友微信唯一id
            Money: message.Money,          // 钱数，单位：分
            Passwd: message.Passwd,        // 密码，6位，纯数字
            Memo: message.Memo,            // 留言
            TaskId: generateTaskId().toString()  // 任务id
        }
        let msg = {
            MsgType: 'RemittanceTask',
            Content: content
        }
        commit('SEND_SOCK', msg)

        // 消息保存本地nedb chats
        let doc = {}
        let redContent = {
            Title: message.Memo,
            Feedesc: '￥' + message.Money / 100,
            Key: '',
            PaySubType: 1,
            InvalidTime: ''
        }
        doc.Content = base64.encode(JSON.stringify(redContent))
        doc.ContentType = 'MoneyTrans'
        doc.FriendId = message.FriendId
        doc.WeChatId = message.WeChatId
        doc.MsgId = content.TaskId
        doc.CreateTime = sendTime.toString()
        doc.IsSend = true
    },

    /**
     * SDK 删除好友
     * <p>
     * <b>请求消息：</b> DeleteFriendTask
     * <b>响应消息：</b> FriendDelNotice
     */
    DeleteFriendTask({ commit, dispatch }, message) {
        let content = {
            WeChatId: message.WeChatId,         // 商家所属微信号
            FriendId: message.FriendId,         // 要删除的微信号
            TaskId: generateTaskId().toString()  // 任务Id
        }
        let msg = {
            MsgType: 'DeleteFriendTask',
            Content: content
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 同意加入群聊
     * <p>
     * <b>请求消息：</b> AgreeJoinChatRoomTask
     * <b>响应消息：</b> TaskResultNotice
     */
    AgreeJoinChatRoomTask({ commit, dispatch }, message) {
        let msg = {
            MsgType: 'AgreeJoinChatRoomTask',
            Content: {
                WeChatId: message.WeChatId,     // 商家个人微信内部全局唯一识别码
                Talker: message.Talker,         // 邀请者
                MsgSvrId: message.MsgSvrId,     // 邀请消息的msgSvrId
                MsgContent: message.MsgContent, // 回传邀请信息的内容（json）
                taskId: generateTaskId().toString()
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 打开红包或转账
     * <p>
     * <b>请求消息：</b> TakeLuckyMoneyTask
     * <b>响应消息：</b> TakeMoneyTaskResultNotice
     */
    TakeLuckyMoneyTask({ commit, dispatch }, message) {
        let msg = {
            MsgType: 'TakeLuckyMoneyTask',
            Content: {
                WeChatId: message.WeChatId,    // 微信唯一Id
                FriendId: message.FriendId,    // 聊天好友微信唯一id
                MsgSvrId: message.MsgSvrId,    // 全局消息id
                MsgKey: message.MsgKey,        // 消息内容中的Key
                TaskId: generateTaskId().toString()
            }
        }
        commit('SEND_SOCK', msg)
        // 添加到数据库
        let doc = {}
        for (const key in msg.Content) {
            if (msg.Content.hasOwnProperty(key)) {
                doc[key] = msg.Content[key]
            }
        }
        dispatch('nedb/InsertLuckMoney', doc, { root: true })
    },

    /**
     * SDK 查询红包详情
     * <p>
     * <b>请求消息：</b> QueryHbDetailTask
     * <b>响应消息：</b> QueryHbDetailTaskResultNotice
     */
    QueryHbDetailTask({ commit, dispatch }, message) {
        let msg = {
            MsgType: 'QueryHbDetailTask',
            Content: {
                WeChatId: message.WeChatId,  // 所属微信号
                HbUrl: message.HbUrl         // 红包key
            }
        }
        commit('SEND_SOCK', msg)
    },

    /**
     * SDK 推送公共号列表
     * <p>
     * <b>请求消息：</b> TriggerBizContactPushTask
     * <b>响应消息：</b> BizContactPushNotice
     */
    TriggerBizContactPushTask({ commit, rootGetters }) {
        let msg = {
            MsgType: 'TriggerBizContactPushTask',
            Content: {
                WeChatId: rootGetters['conversation/currentWeChatId']  // 微信唯一Id
            }
        }
        commit('SEND_SOCK', msg)
    }
}

// mutations
const mutations = {
    /**
     * 发送消息到 WebSocket 服务器
     * <p>
     * 将消息对象序列化为 JSON 后通过 WebSocket 发送。
     *
     * @param {Object} state 状态对象
     * @param {Object} agentData 要发送的消息对象
     */
    SEND_SOCK(state, agentData) {
        sendSock(agentData)
    },

    /**
     * 设置登录页面的 loading 状态
     *
     * @param {Object} state 状态对象
     * @param {Boolean} flag loading 状态
     */
    SET_LOGIN_LOADING(state, flag) {
        state.loginLoading = flag
    }
}

export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}
