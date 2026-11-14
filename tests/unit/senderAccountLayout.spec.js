/**
 * 回归：我方短消息「发送人」挤进横向 flex 导致气泡变窄、两字竖排换行。
 * 发送人行必须在 .chat-content 外侧（对齐 kelailaichatpc ChatItem）。
 */
import { expect } from 'chai'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = resolve(__dirname, '../../src/views/conversation/components/secondPart/ShowChats.vue')
const CHAT_ITEM = resolve(__dirname, '../../src/views/conversation/components/secondPart/ChatItem.vue')
const SRC_TEXT = readFileSync(SRC, 'utf8')
const CHAT_ITEM_TEXT = readFileSync(CHAT_ITEM, 'utf8')
const TPL = CHAT_ITEM_TEXT.match(/<template[^>]*>([\s\S]*?)<\/template>/)[1]
const CHAT_ITEM_STYLE = CHAT_ITEM_TEXT.match(/<style[^>]*scoped[^>]*>([\s\S]*?)<\/style>/)[1]

describe('ChatItem 发送人行布局', () => {
  it('sender-account-info 注释与 DOM 均在 chat-content 外侧', () => {
    expect(TPL).to.match(
      /<\/div>\s*\n\s*<!-- 发送人信息：在 chat-content 外侧[\s\S]*?class="sender-account-info sender-send"/
    )
    const m = TPL.match(/class="sender-account-info sender-send"[\s\S]*?<\/div>\s*\n\s*<\/div>\s*$/)
    expect(m, 'sender 应是 chat-item 的直接子节点').to.be.ok
  })

  it('发送人样式挂在 .chat-item 下且无 width:100%（避免挤窄气泡）', () => {
    expect(CHAT_ITEM_STYLE).to.match(/\.chat-item\s*\{[\s\S]*\.sender-account-info\s*\{/)
    const senderBlock = CHAT_ITEM_STYLE.match(/\.sender-account-info\s*\{([\s\S]*?)\n\s*\}/)
    expect(senderBlock, '应有 .sender-account-info 规则').to.be.ok
    expect(senderBlock[1]).to.not.match(/width:\s*100%/)
    expect(senderBlock[1]).to.match(/display:\s*block/)
  })

  it('ShowChats 使用 ChatItem 组件渲染列表', () => {
    const showTpl = SRC_TEXT.match(/<template[^>]*>([\s\S]*?)<\/template>/)[1]
    expect(showTpl).to.include('<ChatItem')
    expect(showTpl).to.include(':ctx="chatItemCtx"')
    expect(showTpl).not.to.include('class="chat-item"')
  })
})
