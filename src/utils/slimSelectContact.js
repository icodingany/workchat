/**
 * 选中会话时的轻量 contact（对齐 kelailaichatpc stripMemberList 思路）
 * 禁止把 Members/大对象深响应式化，否则连点几次 tab 主线程会被 Proxy 拖死。
 */
import { markRaw } from 'vue'
import { normalizeId } from '@/utils/wechat'

/**
 * @param {object} message 会话列表项
 * @param {object} [otherInfo] 联系人/客户补充
 * @param {Array|string} [labelIds]
 * @returns {object}
 */
export function buildSlimSelectContact(message, otherInfo, labelIds) {
  const src = message && typeof message === 'object' ? message : {}
  const extra = otherInfo && typeof otherInfo === 'object' ? otherInfo : {}
  const contact = {
    Id: normalizeId(src.Id),
    RemoteId: normalizeId(src.RemoteId),
    Name: src.Name || extra.Name || '',
    Alias: src.Alias || extra.Alias || '',
    Avatar: src.Avatar || extra.Avatar || '',
    Digest: src.Digest != null ? String(src.Digest) : '',
    UnreadCnt: Number(src.UnreadCnt) || 0,
    CreateTime: src.CreateTime,
    UpdateTime: src.UpdateTime,
    Type: src.Type,
    LabelIds: labelIds || src.LabelIds || extra.LabelIds || [],
    Notified: src.Notified,
    isTop: !!(src.isTop || src.IsTop),
    IsTop: !!(src.isTop || src.IsTop),
    WxId: src.WxId,
    Attr: src.Attr
  }
  const members = Array.isArray(src.Members)
    ? src.Members
    : Array.isArray(extra.Members)
      ? extra.Members
      : null
  if (members && members.length) {
    contact.Members = markRaw(members)
  }
  const avatars = Array.isArray(src.AvatarList)
    ? src.AvatarList
    : Array.isArray(extra.AvatarList)
      ? extra.AvatarList
      : null
  if (avatars && avatars.length) {
    contact.AvatarList = markRaw(avatars)
  }
  return contact
}
