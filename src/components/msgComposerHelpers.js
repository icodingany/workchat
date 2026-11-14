/** MsgComposer 消息列表与后端 replyContent 互转 */

const TYPE_LABEL = {
  Text: '文本',
  Picture: '图片',
  Voice: '语音',
  Video: '视频',
  Link: '链接',
  WeApp: '小程序',
  File: '文件',
  NameCard: '名片'
}

function pickMessageType(m) {
  return (m && (m.ContentType || m.contentType)) || ''
}

function pickMessageBody(m) {
  return (m && (m.Content != null ? m.Content : m.content)) || ''
}

export function parseReplyContentToMessages(raw) {
  if (!raw || !String(raw).trim()) return []
  const s = String(raw).trim()
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr) && arr.length) {
        return arr
          .map((m) => {
            const ContentType = pickMessageType(m)
            const Content = pickMessageBody(m)
            if (!ContentType || !Content) return null
            const item = {
              ContentType,
              Content,
              desc: (m && m.desc) || ''
            }
            if (ContentType === 'Link' || ContentType === 'WeApp' || ContentType === 'File') {
              try {
                item.jContent = typeof Content === 'string' ? JSON.parse(Content) : Content
                if (!item.desc) {
                  item.desc =
                    (item.jContent && (item.jContent.title || item.jContent.appName || item.jContent.name)) ||
                    ''
                }
              } catch (e) {
                /* ignore */
              }
            }
            if (!item.desc && ContentType === 'Text') item.desc = Content
            return item
          })
          .filter(Boolean)
      }
    } catch (e) {
      /* fallthrough */
    }
  }
  return [{ ContentType: 'Text', Content: s, desc: s }]
}

export function messagesToReplyContent(messages) {
  if (!messages || !messages.length) return ''
  return JSON.stringify(
    messages.map((m) => ({
      ContentType: m.ContentType,
      Content: m.Content
    }))
  )
}

export function replyContentSummary(raw) {
  const list = parseReplyContentToMessages(raw)
  if (!list.length) return '-'
  const first = list[0]
  const label = TYPE_LABEL[first.ContentType] || first.ContentType
  if (list.length === 1 && first.ContentType === 'Text') {
    return first.Content || '-'
  }
  const tip = first.desc || first.Content || ''
  return list.length > 1 ? `${list.length}条 · [${label}] ${tip}` : `[${label}] ${tip}`
}
