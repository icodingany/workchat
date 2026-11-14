/**
 * 消息 ContentType → HTML（ShowChats / FriendChatMessageList 共用）。
 * 依赖通过 ctx 注入，避免组件内三份拷贝。
 */
import errorImg from '@/assets/svg/conversation-image-error.svg'
import transferMoneyImg from '@/assets/svg/conversation-transfer-money.svg'
import phiz from '@/utils/phiz.js'
import { looksLikeEmojiPayload, renderEmojiHtml } from '@/utils/emojiPayload'
import { pickChatField, isResolvableEmptyMedia } from '@/utils/chatMessageFields'
import { decodeMsgContent } from '@/utils/downloadFileDetail'
import { normalizePictureUrl, safeHttpUrl } from '@/utils/picturePreview'
import { isMsgFieldDebugEnabled, logMsgFieldAnomaly, snapshotMsgFields } from '@/utils/msgFieldDebug'
import { escapeHtml } from '@/utils/escapeHtml'
import { pickSphCoverUrl } from '@/utils/shiPinHaoPayload'
import { lookupLuckMoneyOpened } from '@/utils/takeLuckMoney'
import { friendAddGreetingFromChat } from '@/utils/conversationDigest'
import {
  resolveWeworkQuoteFields,
  buildWeworkQuoteBubbleHtml
} from '@/utils/quoteMessage'

/**
 * @typedef {object} DecodeChatContext
 * @property {Record<string, object>} [contactsMap]
 * @property {Record<string, object|boolean>} [luckMoneyMap]
 * @property {Record<string, boolean>} [refundedTransferKeys]
 * @property {string|number} [currentWxId]
 * @property {(chat: object) => boolean} [isSelfMsg]
 * @property {string} [friendNick]
 * @property {boolean} [pictureOnerror] 列表图 onerror 占位（ShowChats=true）
 * @property {boolean} [useCache] 写 chat.__decodedHtml，默认 true
 * @property {Array<object>} [currentChats] 当前会话消息，引用回查原文
 */

function luckMoneyOpenedFlag(chat, luckMoneyMap) {
  if (!luckMoneyMap || !chat) return false
  const rid = pickChatField(chat, 'MsgRemoteId', 'msgRemoteId', 'MsgSvrId', 'msgSvrId')
  if (rid != null && rid !== '') {
    const rec = luckMoneyMap[String(rid)]
    if (rec === true || (rec && rec.opened)) return true
  }
  const legacy = chat.msgSvrId
  if (legacy != null && legacy !== '') {
    const rec = luckMoneyMap[legacy]
    if (rec === true || (rec && rec.opened)) return true
  }
  return false
}

function transferRefundedFlag(chat, jContent, ctx) {
  if (jContent && jContent.PaySubType === 4) return true
  const keys = ctx.refundedTransferKeys || {}
  const wxId = ctx.currentWxId || pickChatField(chat, 'WxId', 'wxId', 'WeChatId')
  if (!wxId || !jContent) return false
  const possible = [jContent.Key, jContent.MsgKey, jContent.TransferId].filter(Boolean)
  return possible.some((k) => !!keys[`${wxId}:${k}`])
}

function pictureImgAttrs(onerror) {
  return onerror
    ? ' referrerpolicy="no-referrer" onerror="this.onerror=null;this.alt=\'图片加载失败，点击重试\';this.title=\'图片加载失败，点击重试\'"'
    : ''
}

function pictureImgHtml(url, title, onerror) {
  return `<img style="max-width:200px;max-height:200px;" src="${url}" title="${title}" alt="图片"${pictureImgAttrs(onerror)}/>`
}

function resolveContentType(chat, jContent) {
  const rawType = pickChatField(chat, 'ContentType', 'contentType', 'content_type')
  let ContentType = rawType != null && rawType !== '' ? rawType : chat.ContentType
  if (
    looksLikeEmojiPayload(jContent) &&
    (ContentType === 'Text' || ContentType === 1 || ContentType === 'System' || ContentType === 5)
  ) {
    ContentType = 'Emoji'
  }
  return ContentType
}

/**
 * @param {object|null|undefined} chat
 * @param {DecodeChatContext} [ctx]
 * @returns {string}
 */
export function decodeChatHtml(chat, ctx = {}) {
  if (!chat) return ''
  if (friendAddGreetingFromChat(chat)) return ''
  const useCache = ctx.useCache !== false
  if (useCache && chat.__decodedHtml != null) return chat.__decodedHtml

  const rawContent = pickChatField(chat, 'Content', 'content')
  const Content = rawContent != null ? rawContent : chat.Content
  const { jContent } = chat
  const ContentType = resolveContentType(chat, jContent)
  const pictureOnerror = ctx.pictureOnerror === true
  const contactsMap = ctx.contactsMap || {}
  const luckMoneyMap = ctx.luckMoneyMap || {}
  const isSelfMsg = ctx.isSelfMsg || (() => false)
  const friendNick = ctx.friendNick || '对方'

  let html = ''

  switch (ContentType) {
    case 'Text':
    case 1:
      html = Content ? phiz.qqFaceImgMap(Content) : '[消息内容为空]'
      break
    case 'Picture':
    case 2: {
      const extUrl = normalizePictureUrl(pickChatField(chat, 'Ext', 'ext'))
      const directUrl = normalizePictureUrl(pickChatField(chat, 'Url', 'url'))
      if (jContent) {
        const picUrl =
          directUrl ||
          extUrl ||
          normalizePictureUrl(jContent.url) ||
          normalizePictureUrl(jContent.midUrl) ||
          normalizePictureUrl(jContent.thumbUrl)
        html = picUrl
          ? pictureImgHtml(picUrl, '点击查看大图', pictureOnerror)
          : pictureImgHtml(errorImg, '图片地址无效，请让对方重发', pictureOnerror)
      } else {
        const fallback = directUrl || extUrl || normalizePictureUrl(Content)
        if (fallback) {
          html = pictureImgHtml(fallback, '点击查看大图', pictureOnerror)
        } else if (isResolvableEmptyMedia(chat)) {
          html = pictureImgHtml(errorImg, '图片加载中，点击重试', pictureOnerror)
        } else {
          html = pictureImgHtml(errorImg, '图片地址无效', pictureOnerror)
        }
      }
      break
    }
    case 'Voice':
    case 3:
      if (jContent) {
        if (jContent.url && jContent.url.endsWith('.mp3')) {
          html = ` <audio src="${jContent.url}" alt="语音" controls></audio>`
        } else {
          html = ` <p>${jContent.url}[语音]文件地址错误，点击重新获取</p>`
        }
      } else {
        html = ` <audio src="${Content}" alt="语音" controls></audio>`
      }
      break
    case 'Video':
    case 4:
      if (jContent) {
        if (safeHttpUrl(jContent.url)) {
          html = `<video style="max-width:300px;max-height:300px;" src="${jContent.url}" type="video/mp4" alt="视频" controls></video>`
        } else if (safeHttpUrl(jContent.thumbUrl)) {
          html = `<img style="max-width:300px;max-height:300px;"  src="${jContent.thumbUrl}"  alt="视频" />
                      <i class="fa fa-play-circle-o fa-2x play-video" aria-hidden="true" title="点击获取视频"></i>`
        } else {
          html = `<img style="max-width:300px;max-height:300px;" src="${errorImg}"  alt="视频" />
                      <i class="fa fa-play-circle-o fa-2x play-video" aria-hidden="true" title="点击获取视频"></i>`
        }
      } else {
        html = `<video style="max-width:300px;max-height:300px;" src="${Content}" type="video/mp4" alt="视频" controls></video>`
      }
      break
    case 'System':
    case 5: {
      const text = decodeMsgContent(Content)
      html = text || '系统消息，内容没有获取到！'
      break
    }
    case 'Link':
    case 6:
    case 'BizLink':
    case 18: {
      if (!jContent) {
        html = Content || '[链接]'
        break
      }
      if (jContent.TypeStr === '[聊天记录]') {
        html = `<span class="link-title">${escapeHtml(jContent.Title || '')}</span><div class="link-content"><span class="link-des">${escapeHtml(
          jContent.Des || ''
        )}</span></div><div class="link-type">聊天记录</div>`
        break
      }
      const linkTitle = escapeHtml(jContent.title || jContent.Title || '')
      const linkDesc = escapeHtml(jContent.desc || jContent.Des || '')
      const linkThumb = safeHttpUrl(jContent.thumbUrl) || errorImg
      const linkTypeLabel = ContentType === 'BizLink' || ContentType === 18 ? '公众号' : '链接'
      html =
        linkTitle || linkDesc || jContent.url
          ? `<span class="link-title">${linkTitle}</span><div class="link-content"><span class="link-des">${linkDesc}</span><img class="link-img" src="${linkThumb}" alt="链接图片" /></div><div class="link-type">${linkTypeLabel}</div>`
          : Content || '[链接]'
      break
    }
    case 'LinkExt':
    case 7:
      if (jContent && (jContent.title || jContent.Title)) {
        const t = escapeHtml(jContent.title || jContent.Title || '')
        const d = escapeHtml(jContent.desc || jContent.Des || '')
        html = `<span class="link-title">${t}</span><div class="link-content"><span class="link-des">${d}</span></div><div class="link-type">链接</div>`
      } else {
        html = Content || '[链接]'
      }
      break
    case 'File':
    case 8:
      if (jContent) {
        let size = 0
        if (jContent.size) {
          if (jContent.size < 1024) size = jContent.size + 'B'
          else if (jContent.size < 1024 * 1024) size = parseInt(jContent.size / 1024) + 'KB'
          else size = parseInt(jContent.size / (1024 * 1024)) + 'MB'
        }
        const fileSize = jContent.Des ? jContent.Des.replace(/,.*/, '') : jContent.size ? size : ''
        const fileTitle = escapeHtml(jContent.Title ? jContent.Title : jContent.name ? jContent.name : '')
        const fileType = jContent.Des
          ? jContent.Des.replace(/.*,/, '').trim()
          : jContent.name
          ? jContent.name.replace(/.*\./, '')
          : ''
        const fileSource = jContent.Source ? jContent.Source : '手机'
        let fileIcon = 'fa-question-circle-o'
        switch (fileType) {
          case 'doc':
          case 'docx':
            fileIcon = 'fa-file-word-o'
            break
          case 'xls':
          case 'xlsx':
            fileIcon = 'fa-file-excel-o'
            break
          case 'ppt':
          case 'pptx':
            fileIcon = 'fa-file-powerpoint-o'
            break
          case 'zip':
          case 'rar':
            fileIcon = 'fa-file-archive-o'
            break
          case 'text':
          case 'txt':
            fileIcon = 'fa-file-text-o'
            break
          case 'mp3':
            fileIcon = 'fa-file-sound-o'
            break
          default:
            break
        }
        html = `<span class="file-title">${fileTitle}</span>
                    <div class="file-content">
                        <span class="file-des">${fileSize}</span>
                        <i class="fa ${fileIcon} file-icon" aria-hidden="true"></i>
                    </div>
                    <div class="file-type">${fileSource}</div>`
      } else {
        html = Content || '[文件]'
      }
      break
    case 'NameCard':
    case 9:
      if (jContent) {
        html = `<div class="namecard-info">
                      <img class="namecard-img" src="${jContent.avatar || errorImg}" alt="好友头像" />
                      <span class="namecard-nickname ellipsis2">${escapeHtml(jContent.name || '')}</span>
                    </div>
                    <div class="namecard-tip">个人名片</div>`
      } else if (contactsMap[Content]) {
        html = `<div class="namecard-info">
                        <img class="namecard-img" src="${contactsMap[Content].Avatar || errorImg}" alt="好友头像" />
                        <span class="namecard-nickname ellipsis2">${escapeHtml(contactsMap[Content].Name || '')}</span>
                      </div>
                      <div class="namecard-tip">个人名片</div>`
      } else {
        html = Content || '[名片]'
      }
      break
    case 'Location':
    case 10: {
      if (jContent) {
        const locTitle = escapeHtml(jContent.title || '')
        const locAddr = escapeHtml(jContent.address || '')
        const locThumb = safeHttpUrl(jContent.url) || errorImg
        html = `<span class="link-title">${locTitle || '位置'}</span><div class="link-content"><span class="link-des">${locAddr}</span><img class="link-img" src="${locThumb}" alt="位置" /></div><div class="link-type">位置</div>`
      } else {
        html = Content || '[位置]'
      }
      break
    }
    case 'LuckyMoney':
    case 11:
      if (jContent && jContent.Key) {
        const openedRecord = lookupLuckMoneyOpened(luckMoneyMap, chat, jContent)
        if (openedRecord && openedRecord.opened) {
          const amount =
            openedRecord.Amount != null
              ? typeof openedRecord.Amount === 'number'
                ? (openedRecord.Amount / 100).toFixed(2)
                : openedRecord.Amount
              : ''
          html = `<div class="luck-info luck-opened">
                    <span class="luck-icon"><i class="iconfont jubo-lucky-money"></i></span>
                    <span class="luck-amount">${amount ? '¥' + amount : ''}</span>
                    <span class="luck-claimed-tip">已被领取</span>
                  </div>`
        } else {
          const wish = escapeHtml((jContent && jContent.Title) || '恭喜发财，大吉大利')
          html = `<div class="luck-info">
                    <span class="luck-icon"><i class="iconfont jubo-lucky-money"></i></span>
                    <span class="luck-wish">${wish}</span>
                  </div>
                  <div class="luck-divider"></div>
                  <div class="luckmoney-tip">微信红包</div>`
        }
      } else {
        html = Content || '[红包]'
      }
      break
    case 'MoneyTrans':
    case 12: {
      if (!jContent) {
        html = Content || '[转账]'
        break
      }
      let moneyTransFlag = ''
      let money = 0
      if (jContent.Feedesc) money = jContent.Feedesc
      const refunded = transferRefundedFlag(chat, jContent, ctx)
      switch (jContent.PaySubType) {
        case 1:
          moneyTransFlag = isSelfMsg(chat) ? `转账给${friendNick}` : '转账给你'
          break
        case 3:
          moneyTransFlag = '已收钱'
          break
        case 4:
          moneyTransFlag = '已退还'
          break
        default:
          break
      }
      if (refunded && jContent.PaySubType !== 3) {
        moneyTransFlag = '已退还'
      }
      if (jContent.PaySubType === 3) {
        html = `
                          <div class="moneytran-info">
                              <img class="moneytran-img" src="${transferMoneyImg}" alt />
                              <span class="moneytran-feed" >${money}</span>
                              <span class="moneytran-flag">${moneyTransFlag}</span>
                              <span class="moneytran-flag"></span>
                          </div>
                          <div class="moneytran-tip">微信转账</div>`
      } else {
        let flag = ''
        if (refunded) flag = '已退还'
        else if (luckMoneyOpenedFlag(chat, luckMoneyMap)) flag = '已被领取'
        html = `
                          <div class="moneytran-info">
                              <img class="moneytran-img" src="${transferMoneyImg}" alt />
                              <span class="moneytran-feed" >${money}</span>
                              <span class="moneytran-flag">${moneyTransFlag}</span>
                              <span class="moneytran-flag">${flag}</span>
                          </div>
                          <div class="moneytran-tip">微信转账</div>`
      }
      break
    }
    case 'WeApp':
    case 13: {
      if (!jContent) {
        html = Content || '[小程序]'
        break
      }
      const appIcon = jContent.iconUrl ? jContent.iconUrl : errorImg
      const appTitle = escapeHtml(jContent.title ? jContent.title : '无效小程序')
      const appDes = escapeHtml(jContent.desc ? jContent.desc : '')
      const appSource = escapeHtml(jContent.appName ? jContent.appName : '无效小程序')
      const appThumb = safeHttpUrl(jContent.thumbUrl) || errorImg
      const appTypeStr = jContent.type === 2 ? '小程序' : jContent.type || '小程序'
      html = `
                      <div class="app-des">
                      <img class="app-icon" src="${appIcon}" alt="icon" />
                      <span class="app-source ellipsis">${appSource}</span>
                      </div>
                      <div class="app-title ellipsis">${appTitle}</div>
                      <div class="app-content">
                          <span class="app-des">${appDes}</span>
                          <img class="app-img" src="${appThumb}" />
                      </div>
                      <div class="app-typestr">${appTypeStr}</div>`
      break
    }
    case 'Emoji':
    case 14:
    case '14':
      html = renderEmojiHtml(jContent, Content)
      break
    case 'RoomManage':
    case 15:
      html = Content || '[群管理]'
      break
    case 'Sys_LuckyMoney':
    case 16:
      html = (jContent && jContent.Title) || Content || '[红包]'
      break
    case 'RoomSystem':
    case 17:
      html = (jContent && jContent.title) || Content || '[群通知]'
      break
    case 'AudioCall':
    case 19:
      html = (jContent && (jContent.title || jContent.text)) || Content || '[语音通话]'
      break
    case 'VideoCall':
    case 20:
      html = (jContent && (jContent.title || jContent.text)) || Content || '[视频通话]'
      break
    case 'NotifyMsg':
    case 21:
      if (!jContent) html = Content || '[服务通知]'
      else {
        html = `<span class="link-title">${escapeHtml(jContent.source || '')}</span>
                <div class="link-content">
                <span class="link-des">${escapeHtml(jContent.title || '')}</span>
                </div>
                <div class="link-type">${escapeHtml(jContent.des || '服务通知')}</div>`
      }
      break
    case 'QuoteMsg':
    case 22: {
      if (!jContent) {
        html = Content || '[引用消息]'
        break
      }
      const resolved = resolveWeworkQuoteFields(jContent, ctx.currentChats)
      const quoteText = phiz.qqFaceImgMap(resolved.text || '')
      const quoted = escapeHtml((resolved.quote && resolved.quote.text) || '')
      const quoteName = escapeHtml((resolved.quote && resolved.quote.senderName) || '')
      const quoteMsgRid = resolved.quote && resolved.quote.msgRid
      html = buildWeworkQuoteBubbleHtml({
        replyHtml: quoteText,
        quoteName,
        quoteHtml: quoted,
        quoteMsgRid
      })
      break
    }
    case 'ForwardMsg':
    case 23: {
      if (!jContent) {
        html = Content || '[聊天记录]'
        break
      }
      const fwdTitle = escapeHtml(jContent.title || '聊天记录')
      const fwdCount = jContent.msgs && jContent.msgs.length ? jContent.msgs.length + '条消息' : ''
      html = `<span class="link-title">${fwdTitle}</span><div class="link-content"><span class="link-des">${fwdCount}</span></div><div class="link-type">聊天记录</div>`
      break
    }
    case 'SnsNotify':
    case 24:
      html = (jContent && (jContent.title || jContent.des)) || Content || '[朋友圈通知]'
      break
    case 'ShiPinHao':
    case 25: {
      if (!jContent) {
        html = Content || '[视频号]'
        break
      }
      const sphName = escapeHtml(jContent.nickname || jContent.Nickname || '视频号')
      const sphDes = escapeHtml(jContent.des || jContent.Des || jContent.title || jContent.Title || '')
      const sphThumb = safeHttpUrl(pickSphCoverUrl(jContent)) || errorImg
      const sphAvatar = safeHttpUrl(jContent.avatar || jContent.Avatar) || errorImg
      html = `
                      <div class="app-des">
                      <img class="app-icon" src="${sphAvatar}" alt="icon" />
                      <span class="app-source ellipsis">${sphName}</span>
                      </div>
                      <div class="app-title ellipsis">${sphDes}</div>
                      <img class="app-img" src="${sphThumb}" />
                      <div class="app-typestr">视频号</div>`
      break
    }
    case 'AppFunCard':
    case 26: {
      if (!jContent) html = Content || '[功能卡片]'
      else {
        const cardTitle = escapeHtml(jContent.title || '功能卡片')
        html = `<span class="link-title">${cardTitle}</span><div class="link-type">功能卡片</div>`
      }
      break
    }
    case 'UnknownContent':
    case 0:
    case 'UnSupport':
    case 99:
      if (isMsgFieldDebugEnabled() && (Content == null || Content === '')) {
        logMsgFieldAnomaly('decode.unsupported', chat, { ContentType, snap: snapshotMsgFields(chat) })
      }
      html = Content || '[不支持的消息]'
      break
    default: {
      if (isMsgFieldDebugEnabled()) {
        logMsgFieldAnomaly('decode.default', chat, {
          ContentType,
          ContentType_raw: chat.ContentType,
          contentType_raw: chat.contentType,
          Content_len: Content != null ? String(Content).length : 0,
          snap: snapshotMsgFields(chat)
        })
      }
      const typeLabel = ContentType != null && ContentType !== '' ? ContentType : '未知'
      if (Content != null && Content !== '') {
        html =
          typeof Content === 'string' && ContentType === 'Text'
            ? phiz.qqFaceImgMap(Content)
            : String(Content)
      } else {
        html = `[${typeLabel}]`
      }
    }
  }

  if (useCache) chat.__decodedHtml = html
  return html
}
