/**
 * ShowChats 大图预览（模板级回归）。
 *
 * 行为逻辑已拆到纯函数 src/utils/picturePreview.js（picturePreview.spec.js 覆盖 15 条），
 * 本文件锁定模板形态的结构性回归，确保"旧 hack 不再复活"：
 * - 直挂 el-image-viewer，不再用隐藏 el-image + 程序化 click()
 * - 用 :key 强制切图重置
 * - 列表图片带 onerror 占位 + referrerpolicy 防盗链
 */
import { expect } from 'chai'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = resolve(__dirname, '../../src/views/conversation/components/secondPart/ShowChats.vue')
const SRC_TEXT = readFileSync(SRC, 'utf8')
/** 主模板区（含嵌套 #footer 等 slot template，不能只用第一个 </template>） */
const MAIN_TEMPLATE = SRC_TEXT.split('<script>')[0]
const MIXIN_UI = resolve(__dirname, '../../src/views/conversation/components/secondPart/showChatsMixin/methodsUi.js')
const MIXIN_IMAGE = resolve(__dirname, '../../src/views/conversation/components/secondPart/showChatsMixin/methodsImagePreview.js')
const CHAT_ITEM = resolve(__dirname, '../../src/views/conversation/components/secondPart/ChatItem.vue')
const MIXIN_UI_TEXT = readFileSync(MIXIN_UI, 'utf8')
const MIXIN_IMAGE_TEXT = readFileSync(MIXIN_IMAGE, 'utf8')
const CHAT_ITEM_TEXT = readFileSync(CHAT_ITEM, 'utf8')

describe('ShowChats 大图预览模板', () => {
  it('直挂 el-image-viewer（不再用隐藏 el-image 触发器）', () => {
    const tpl = MAIN_TEMPLATE
    expect(tpl.includes('el-image-viewer')).to.equal(true)
    expect(tpl.includes(':url-list')).to.equal(true)
    expect(tpl.includes('@close="closeBigImagePreview"')).to.equal(true)
  })

  it('旧 hack 已彻底移除：无 preview-src-list / clickHandler / getElementById', () => {
    const tpl = MAIN_TEMPLATE
    expect(tpl.includes('preview-src-list')).to.equal(false)
    expect(tpl.includes('clickHandler()')).to.equal(false)
    expect(tpl.includes('getElementById')).to.equal(false)
  })

  it('用 v-if + :key 受 bigImagePreviewVisible 驱动（可重置缩放/位置）', () => {
    const tpl = MAIN_TEMPLATE
    expect(tpl).to.include('v-if="bigImagePreviewVisible"')
    expect(tpl).to.include(':key="bigImagePreviewKey"')
  })

  it('列表图片带 referrerpolicy 防盗链 + onerror 占位防破图（在 decodeChatHtml 模块中）', () => {
    const decodeSrc = readFileSync(resolve(__dirname, '../../src/utils/decodeChatHtml.js'), 'utf8')
    expect(decodeSrc).to.include('referrerpolicy="no-referrer"')
    expect(decodeSrc).to.include('this.onerror=null')
    expect(decodeSrc).to.include('图片加载失败，点击重试')
    expect(MIXIN_UI_TEXT).to.include("from '@/utils/decodeChatHtml'")
  })

  it('resolvePictureUrl 方法委托 picturePreview 模块（禁止自递归 resolvePictureUrl(chat)）', () => {
    expect(MIXIN_UI_TEXT).to.include('return _resolvePictureUrl(chat)')
    expect(MIXIN_UI_TEXT).not.to.match(/resolvePictureUrl\(chat\)\s*\{[\s\S]*?return resolvePictureUrl\(chat\)/)
  })

  it('显式注册 ElImageViewer 组件', () => {
    expect(SRC_TEXT).to.include("import { ElImageViewer } from 'element-plus'")
    expect(SRC_TEXT).to.include('ElImageViewer')
  })

  it('大图预览尺寸限制在非 scoped 样式块（teleported 到 body 才能生效）', () => {
    expect(SRC_TEXT).to.include('<!-- 图片预览器 teleported 到 body，需非 scoped 样式 -->')
    expect(SRC_TEXT).to.match(/<style lang="scss">\s*[\s\S]*\.el-image-viewer__img[\s\S]*max-width:\s*90vw/)
    expect(SRC_TEXT).to.include('max-height: 90vh !important')
    expect(MIXIN_IMAGE_TEXT).to.include('patchBigImageViewerImg')
    expect(MIXIN_IMAGE_TEXT).to.include("img.referrerPolicy = 'no-referrer'")
  })

  it('资源获取失败在图片下方展示，不弹全局 toast', () => {
    expect(CHAT_ITEM_TEXT).to.include('msg-resource-fetch-error')
    expect(CHAT_ITEM_TEXT).to.include('resourceFetchError')
    expect(CHAT_ITEM_TEXT).not.to.include('资源地址获取失败！')
  })

  it('openPicturePreview / fetchOriginalImageAsync 不得为空壳（拆分回归）', () => {
    expect(MIXIN_IMAGE_TEXT).to.match(
      /openPicturePreview\s*\([^)]*\)\s*\{[\s\S]*?normalizePictureUrl/
    )
    expect(MIXIN_IMAGE_TEXT).to.match(
      /fetchOriginalImageAsync\s*\([^)]*\)\s*\{[\s\S]*?downloadFileByMsgIdTask/
    )
    expect(MIXIN_IMAGE_TEXT).not.to.match(/openPicturePreview\s*\([^)]*\)\s*\{\s*\}/)
    expect(MIXIN_IMAGE_TEXT).not.to.match(/fetchOriginalImageAsync\s*\([^)]*\)\s*\{\s*\}/)
  })
})