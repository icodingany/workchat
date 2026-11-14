/**
 * 通用工具函数
 * <p>
 * 提供应用中常用的工具方法。
 */

/**
 * 生成唯一任务 ID
 * <p>
 * 基于时间戳和随机数生成唯一标识符，用于标识各种异步任务。
 * <p>
 * <b>生成规则：</b>
 * <pre>
 * taskId = 当前时间戳(毫秒) * 10000 + 随机数(0-9999)
 * </pre>
 * <p>
 * <b>使用场景：</b>
 * <ul>
 *   <li>群发消息任务 ID</li>
 *   <li>清理僵尸粉任务 ID</li>
 *   <li>修改备注任务 ID</li>
 *   <li>红包/转账任务 ID</li>
 * </ul>
 *
 * @returns {string} 唯一的任务 ID（十进制字符串，落在 int64 范围内）
 *
 * @example
 * const taskId = generateTaskId()
 * // 示例输出：16991234567890 * 10000 + 1234 = 16991234567891234
 */
/** 2^18；与 kelailaichatpc 一致，TaskId 用 BigInt 生成十进制字符串，避免 JS Number 精度丢失 */
const TASK_ID_RADIX = 262144n

/**
 * 生成 TaskId（protobuf int64；须用字符串经 JSON 传输，避免超过 MAX_SAFE_INTEGER 后回执对不上）
 * @returns {string}
 */
export const generateTaskId = () => {
  const t = BigInt(Date.now())
  const r = BigInt(Math.floor(Math.random() * Number(TASK_ID_RADIX)))
  return (t * TASK_ID_RADIX + r).toString()
}

/**
 * 数组去重
 * <p>
 * 根据指定字段对数组进行去重，保留首次出现的元素。
 * <p>
 * <b>去重逻辑：</b>
 * <pre>
 * 1. 外层循环遍历数组（索引 i）
 * 2. 内层循环比较后续元素（索引 j = i + 1）
 * 3. 如果关键字段相同，删除后者（splice），j 自减
 * </pre>
 * <p>
 * <b>支持两种模式：</b>
 * <ul>
 *   <li>对象数组：根据 keyWord 字段比较</li>
 *   <li>基础数组：直接比较值</li>
 * </ul>
 *
 * @param {Array} targartArry 目标数组
 * @param {String} keyWord 去重依据的字段名（对象数组必传）
 * @returns {Array} 去重后的数组
 *
 * @example
 * // 对象数组去重
 * const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 1, name: 'A' }]
 * uniqueArryList(users, 'id') // [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
 *
 * // 基础数组去重
 * const nums = [1, 2, 2, 3, 3, 3]
 * uniqueArryList(nums) // [1, 2, 3]
 */
export const uniqueArryList = (targartArry, keyWord) => {
    for (let i = 0; i < targartArry.length; i++) {
        for (let j = i + 1; j < targartArry.length; j++) {
            if (typeof targartArry[i] === 'object') {
                // 对象数组：比较指定字段
                if (targartArry[i][keyWord] === targartArry[j][keyWord]) {
                    // 第一个等同于第二个，splice方法删除第二个
                    targartArry.splice(j, 1)
                    j--
                }
            } else {
                // 基础数组：直接比较值
                if (targartArry[i] === targartArry[j]) {
                    // 第一个等同于第二个，splice方法删除第二个
                    targartArry.splice(j, 1)
                    j--
                }
            }
        }
    }
    // console.log(targartArry)
    return targartArry
}
