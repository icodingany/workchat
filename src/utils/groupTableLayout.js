/**
 * 群发助手表格窄容器紧凑布局（GroupAssistantSend 用）。
 *
 * 背景：群发选人表格在企微客户端内嵌网页（侧边栏/工作台，主区仅 ~240-400px）
 * 中打开时，序号(100px)+昵称+备注名+性别+群成员人数+勾选列的最小总宽 ~528px
 * 放不下，溢出列（含勾选框）被 el-table 裁剪且无横向滚动条，表现为
 * 「勾选框挤压在一起、群昵称显示不了」。UA 的 isMobile() 判不到企微内嵌
 * 桌面内核，必须按容器实际宽度切换布局。
 */

/** 低于该容器宽度切紧凑布局（完整布局最小需求 ~528px，600 留余量） */
export const GROUP_TABLE_COMPACT_WIDTH = 600

/**
 * 是否用紧凑布局：序号 50 / 隐藏备注名与性别 / 群成员人数 90 / 勾选 44。
 * @param {Number} width 表格容器实际宽度（ResizeObserver contentRect.width）
 * @returns {Boolean}
 */
export function groupTableCompact(width) {
  if (!Number.isFinite(width)) return true
  return width < GROUP_TABLE_COMPACT_WIDTH
}
