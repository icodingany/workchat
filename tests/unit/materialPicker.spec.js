import { expect } from 'chai'
import {
  normalizeMaterialType,
  parseMaterialContent,
  materialToComposerMsg,
  materialCircleFill,
  filterMaterialsByType
} from '@/utils/resourcePayload'

/**
 * 回归 2026-08-28：群发与发朋友圈增加「从素材库选择」（对齐个微）。
 * 收藏素材（/user/resources/pageList）按类型选择后：
 * - 群发：映射为 MsgComposer msgList 消息（ContentType/Content/desc/jContent）
 * - 发圈：回填 FriendCircleSend 表单（text/imageUrls/video/link 三件套）
 * 旧数字类型（2/3/4/6/8/13/14/25）须归一化为协议名；群发不支持的类型（Emoji/ShiPinHao）
 * 必须返回 null（后端 resolveContentType 会把它们错误降级为 Text）。
 */
describe('素材选择：类型归一化', () => {
  it('旧数字类型映射为协议名', () => {
    expect(normalizeMaterialType(2)).to.equal('Picture')
    expect(normalizeMaterialType('2')).to.equal('Picture')
    expect(normalizeMaterialType(3)).to.equal('Voice')
    expect(normalizeMaterialType(4)).to.equal('Video')
    expect(normalizeMaterialType(6)).to.equal('Link')
    expect(normalizeMaterialType(8)).to.equal('File')
    expect(normalizeMaterialType(13)).to.equal('WeApp')
    expect(normalizeMaterialType(25)).to.equal('ShiPinHao')
  })

  it('聊天收藏的文本消息 ContentType=1 也归一化为 Text（2026-09-01 素材库选不到）', () => {
    expect(normalizeMaterialType(1)).to.equal('Text')
    expect(normalizeMaterialType('1')).to.equal('Text')
  })

  it('协议名原样返回', () => {
    expect(normalizeMaterialType('Picture')).to.equal('Picture')
    expect(normalizeMaterialType('Text')).to.equal('Text')
    expect(normalizeMaterialType(null)).to.equal('')
  })
})

describe('素材选择：按类型过滤（混合新旧 type 存储）', () => {
  const rows = [
    { id: 1, type: 'Text', content: '协议名文本' },
    { id: 2, type: 1, content: '数字文本' },
    { id: 3, type: '1', content: '字符串数字文本' },
    { id: 4, type: 2, content: 'https://a.jpg' },
    { id: 5, type: 'Picture', content: '{"url":"https://b.jpg"}' },
    { id: 6, type: 6, content: '{"title":"旧链接"}' },
    { id: 7, type: 14, content: '{}' },
    { id: 8, type: null, content: 'x' }
  ]

  it('Text 标签同时命中协议名与数字 1 的行', () => {
    const hit = filterMaterialsByType(rows, 'Text')
    expect(hit.map((r) => r.id)).to.deep.equal([1, 2, 3])
  })

  it('Picture 标签命中数字 2 与协议名两行', () => {
    expect(filterMaterialsByType(rows, 'Picture').map((r) => r.id)).to.deep.equal([4, 5])
  })

  it('Link 标签命中数字 6 行', () => {
    expect(filterMaterialsByType(rows, 'Link').map((r) => r.id)).to.deep.equal([6])
  })

  it('未知/空类型行不进入任何标签', () => {
    expect(filterMaterialsByType(rows, 'Video')).to.deep.equal([])
  })

  it('rows 非数组时返回空数组', () => {
    expect(filterMaterialsByType(null, 'Text')).to.deep.equal([])
    expect(filterMaterialsByType(undefined, 'Text')).to.deep.equal([])
  })
})

describe('素材选择：content 解析', () => {
  it('JSON 字符串解析为对象', () => {
    expect(parseMaterialContent('{"url":"https://a.jpg"}')).to.deep.equal({ url: 'https://a.jpg' })
  })
  it('纯文本/URL 原样返回字符串', () => {
    expect(parseMaterialContent('https://a.jpg')).to.equal('https://a.jpg')
    expect(parseMaterialContent('你好')).to.equal('你好')
  })
  it('对象原样返回', () => {
    const obj = { url: 'x' }
    expect(parseMaterialContent(obj)).to.equal(obj)
  })
})

describe('素材选择：群发消息映射', () => {
  it('Text 素材 → 文本消息', () => {
    const msg = materialToComposerMsg({ type: 'Text', content: '促销文案' })
    expect(msg).to.deep.equal({ ContentType: 'Text', Content: '促销文案', desc: '促销文案' })
  })

  it('Picture 素材（JSON content）→ 图片消息并带 thumbUrl', () => {
    const msg = materialToComposerMsg({ type: 'Picture', content: '{"url":"https://a.jpg"}' })
    expect(msg).to.deep.equal({
      ContentType: 'Picture',
      Content: 'https://a.jpg',
      desc: '图片',
      thumbUrl: 'https://a.jpg'
    })
  })

  it('Picture 素材（纯 URL 字符串）→ 图片消息', () => {
    const msg = materialToComposerMsg({ type: 'Picture', content: 'https://b.jpg' })
    expect(msg.Content).to.equal('https://b.jpg')
    expect(msg.thumbUrl).to.equal('https://b.jpg')
  })

  it('Video 素材（JSON content）→ 视频消息', () => {
    const msg = materialToComposerMsg({ type: 'Video', content: '{"url":"https://v.mp4"}' })
    expect(msg).to.deep.equal({
      ContentType: 'Video',
      Content: 'https://v.mp4',
      desc: '视频',
      thumbUrl: 'https://v.mp4'
    })
  })

  it('Link 素材 → 链接消息（jContent + desc=title）', () => {
    const msg = materialToComposerMsg({
      type: 'Link',
      content: '{"title":"活动","url":"https://l","thumbUrl":"https://t.jpg"}'
    })
    expect(msg.ContentType).to.equal('Link')
    expect(msg.desc).to.equal('活动')
    expect(msg.jContent).to.deep.equal({ title: '活动', url: 'https://l', thumbUrl: 'https://t.jpg' })
    expect(msg.thumbUrl).to.equal('https://t.jpg')
    expect(() => JSON.parse(msg.Content)).to.not.throw()
  })

  it('WeApp 素材 → 小程序消息（desc=appName）', () => {
    const msg = materialToComposerMsg({
      type: 'WeApp',
      content: '{"appName":"小程序","iconUrl":"https://i.png"}'
    })
    expect(msg.ContentType).to.equal('WeApp')
    expect(msg.desc).to.equal('小程序')
    expect(msg.thumbUrl).to.equal('https://i.png')
  })

  it('旧数字类型（2=图片）可正常映射', () => {
    const msg = materialToComposerMsg({ type: 2, content: 'https://c.jpg' })
    expect(msg.ContentType).to.equal('Picture')
  })

  it('群发不支持的类型（Emoji/ShiPinHao/File 之外的语音除外）返回 null', () => {
    expect(materialToComposerMsg({ type: 'Emoji', content: '{}' })).to.equal(null)
    expect(materialToComposerMsg({ type: 'ShiPinHao', content: '{}' })).to.equal(null)
    expect(materialToComposerMsg({ type: 14, content: '{}' })).to.equal(null)
  })

  it('Voice/File 素材可映射（后端 resolveContentType 支持）', () => {
    expect(materialToComposerMsg({ type: 'Voice', content: 'https://a.mp3' }).ContentType).to.equal('Voice')
    expect(materialToComposerMsg({ type: 'File', content: 'https://a.pdf' }).ContentType).to.equal('File')
  })
})

describe('素材选择：发朋友圈回填', () => {
  it('Text 素材 → 文案回填', () => {
    expect(materialCircleFill({ type: 'Text', content: '文案' })).to.deep.equal({
      circleType: 'text',
      text: '文案'
    })
  })

  it('Picture 素材 → 图片列表回填并切到图片类型', () => {
    expect(materialCircleFill({ type: 'Picture', content: '{"url":"https://a.jpg"}' })).to.deep.equal({
      circleType: 'picture',
      imageUrls: ['https://a.jpg']
    })
  })

  it('Video 素材 → 视频回填并切到视频类型', () => {
    expect(materialCircleFill({ type: 'Video', content: 'https://v.mp4' })).to.deep.equal({
      circleType: 'video',
      video: 'https://v.mp4'
    })
  })

  it('Link 素材 → 链接三件套回填并切到链接类型', () => {
    expect(
      materialCircleFill({
        type: 'Link',
        content: '{"title":"T","url":"https://u","thumbUrl":"https://t.jpg"}'
      })
    ).to.deep.equal({
      circleType: 'link',
      linkUrl: 'https://u',
      linkTitle: 'T',
      linkImg: 'https://t.jpg'
    })
  })

  it('朋友圈不支持的类型返回 null', () => {
    expect(materialCircleFill({ type: 'Emoji', content: '{}' })).to.equal(null)
    expect(materialCircleFill({ type: 'Voice', content: 'x' })).to.equal(null)
  })
})
