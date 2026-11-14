/**
 * workchat 本地数据库 - IndexedDB (Dexie)
 * <p>
 * 使用 Dexie 封装 IndexedDB，提供高效的本地数据存储。
 * <p>
 * <b>迁移说明：</b>
 * <pre>
 * 原先使用 NeDB（文件数据库），现已迁移到 IndexedDB（浏览器内置）。
 * 通过 dexieAdapter 提供 NeDB 兼容的 API（find/insert/update/remove），
 * 使得 store 模块的 import 路径不需要修改。
 * </pre>
 * <p>
 * <b>数据表说明：</b>
 * <table>
 *   <tr><th>表名</th><th>主键</th><th>索引</th><th>说明</th></tr>
 *   <tr><td>contacts</td><td>_id</td><td>WxId</td><td>企业联系人</td></tr>
 *   <tr><td>departments</td><td>_id</td><td>WxId</td><td>部门信息</td></tr>
 *   <tr><td>customers</td><td>_id</td><td>WxId, RemoteId</td><td>我的客户</td></tr>
 *   <tr><td>corporations</td><td>_id</td><td>WxId</td><td>客户公司信息</td></tr>
 *   <tr><td>labels</td><td>_id</td><td>WeChatId</td><td>客户标签</td></tr>
 *   <tr><td>addCustomerFromSearchTask</td><td>_id</td><td>TaskId, userId, WxId</td><td>搜索加好友任务</td></tr>
 *   <tr><td>chatRoomTask</td><td>_id</td><td>TaskId</td><td>群管理任务</td></tr>
 *   <tr><td>chatRoomConfig</td><td>_id</td><td>WeChatId, ChatRoomId</td><td>群配置</td></tr>
 *   <tr><td>memoTask</td><td>_id</td><td>TaskId</td><td>备注和标签操作任务</td></tr>
 *   <tr><td>luckMoney</td><td>_id</td><td>userId, WeChatId, MsgKey</td><td>红包/转账记录</td></tr>
 *   <tr><td>groupSendTask</td><td>_id</td><td>TaskId, userId, WxId</td><td>群发任务</td></tr>
 *   <tr><td>chats</td><td>_id</td><td>userId, WxId, ConvId, MsgId, MsgRemoteId</td><td>会话消息本地缓存</td></tr>
 * </table>
 */
import Dexie from 'dexie'

/**
 * workchat 数据库类
 * <p>
 * 继承自 Dexie，定义数据库版本和表结构。
 * <p>
 * <b>版本管理：</b>
 * <pre>
 * 当前版本：2（v1 初始化表结构，v2 新增 chats 表）
 * 如需修改表结构，需要创建新版本并编写迁移脚本。
 * </pre>
 */
class WorkchatDatabase extends Dexie {
    constructor() {
        // 数据库名称：WorkchatDB
        super('WorkchatDB')

        /**
         * 版本 1 - 初始化表结构
         * <p>
         * 使用 Dexie 的 stores 方法定义表和索引。
         * <p>
         * <b>语法说明：</b>
         * <pre>
         * 'primaryKey, index1, index2, ...'
         * - 主键自动递增：++
         * - 复合索引：[index1 + index2]
         * - 唯一索引：&index
         * </pre>
         */
        this.version(1).stores({
            /** 企业联系人表 */
            contacts: '_id, WxId',

            /** 部门信息表 */
            departments: '_id, WxId',

            /** 我的客户表 */
            customers: '_id, WxId, RemoteId',

            /** 客户公司信息表 */
            corporations: '_id, WxId',

            /** 客户标签表 */
            labels: '_id, WeChatId',

            /** 搜索加好友任务表 */
            addCustomerFromSearchTask: '_id, TaskId, userId, WxId',

            /** 群管理任务表 */
            chatRoomTask: '_id, TaskId',

            /** 群配置表 */
            chatRoomConfig: '_id, WeChatId, ChatRoomId',

            /** 备注和标签操作任务表 */
            memoTask: '_id, TaskId',

            /** 红包/转账记录表 */
            luckMoney: '_id, userId, WeChatId, MsgKey',

            /** 群发任务表 */
            groupSendTask: '_id, TaskId, userId, WxId'
        })

        this.version(2).stores({
            chats: '_id, userId, WxId, ConvId, MsgId, MsgRemoteId'
        })

        /**
         * 表对象引用
         * <p>
         * 将 Dexie 表对象挂载到实例上，便于访问。
         */
        this.contacts = this.table('contacts')
        this.departments = this.table('departments')
        this.customers = this.table('customers')
        this.corporations = this.table('corporations')
        this.labels = this.table('labels')
        this.addCustomerFromSearchTask = this.table('addCustomerFromSearchTask')
        this.chatRoomTask = this.table('chatRoomTask')
        this.chatRoomConfig = this.table('chatRoomConfig')
        this.memoTask = this.table('memoTask')
        this.luckMoney = this.table('luckMoney')
        this.groupSendTask = this.table('groupSendTask')
        this.chats = this.table('chats')
    }
}

/**
 * 导出数据库实例
 * <p>
 * 单例模式，整个应用共享同一个数据库实例。
 */
export const workchatDB = new WorkchatDatabase()
