export const REG_CODE_STATUS = {
  ALL: -3,
  DESTROYED: -2,
  DISABLED: -1,
  UNUSED: 0,
  USED: 1
}

export const REG_CODE_STATUS_OPTIONS = [
  { text: '全部状态', value: REG_CODE_STATUS.ALL },
  { text: '待使用', value: REG_CODE_STATUS.UNUSED },
  { text: '已使用', value: REG_CODE_STATUS.USED },
  { text: '已禁用', value: REG_CODE_STATUS.DISABLED },
  { text: '已销毁', value: REG_CODE_STATUS.DESTROYED }
]

const STATUS_CONFIG = {
  [REG_CODE_STATUS.DESTROYED]: { type: 'danger', text: '已销毁' },
  [REG_CODE_STATUS.DISABLED]: { type: 'warning', text: '已禁用' },
  [REG_CODE_STATUS.UNUSED]: { type: 'info', text: '待使用' },
  [REG_CODE_STATUS.USED]: { type: 'success', text: '已使用' }
}

export function getRegCodeStatusType(used) {
  return (STATUS_CONFIG[used] && STATUS_CONFIG[used].type) || 'info'
}

export function getRegCodeStatusText(used) {
  return (STATUS_CONFIG[used] && STATUS_CONFIG[used].text) || '未知'
}
