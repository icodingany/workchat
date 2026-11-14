/**
 * 本地数据存储入口
 * <p>
 * 统一导出本地数据库操作接口，兼容原有 NeDB API 调用。
 * <p>
 * <b>架构说明：</b>
 * <pre>
 * 原先：NeDB（内存 + 文件持久化）
 * 现在：IndexedDB（浏览器内置）+ Dexie（封装）
 * </pre>
 * <p>
 * <b>兼容层：</b>
 * <pre>
 * 通过 dexieAdapter 提供 NeDB 兼容的 API：
 * - find(query, callback)
 * - insert(doc, callback)
 * - update(query, update, options, callback)
 * - remove(query, options, callback)
 * </pre>
 * <p>
 * <b>使用方式：</b>
 * <pre>
 * import nedb from '@/db/nedb'
 * nedb.customers.insert({ ... }, (err, newDoc) => { ... })
 * nedb.customers.find({ WxId: 'xxx' }, (err, docs) => { ... })
 * </pre>
 * <p>
 * <b>保留原因：</b>
 * <ul>
 *   <li>store 模块中大量使用 nedb.customers/contacts 等引用</li>
 *   <li>修改导入路径会影响大量文件</li>
 *   <li>通过适配器模式实现平滑迁移</li>
 * </ul>
 */
import adapter from './dexieAdapter'
import { workchatDB } from './dexie/database'

/**
 * 打开数据库
 * <p>
 * Dexie 在首次访问时自动打开数据库，这里显式调用是为了：
 * <ul>
 *   <li>确保数据库在应用启动时准备就绪</li>
 *   <li>捕获可能的初始化错误</li>
 * </ul>
 */
workchatDB.open().catch((err) => {
    console.error('[workchatDB] 打开 IndexedDB 失败:', err)
})

/**
 * 导出适配器
 * <p>
 * 适配器提供与 NeDB 兼容的 API，内部使用 Dexie 操作 IndexedDB。
 * <p>
 * <b>可用的表：</b>
 * <pre>
 * adapter.contacts       // 企业联系人
 * adapter.departments    // 部门信息
 * adapter.customers     // 我的客户
 * adapter.corporations  // 客户公司
 * adapter.labels        // 客户标签
 * adapter.chatRoomTask   // 群管理任务
 * adapter.memoTask      // 备注任务
 * adapter.luckMoney      // 红包记录
 * adapter.groupSendTask  // 群发任务
 * </pre>
 */
export default adapter
