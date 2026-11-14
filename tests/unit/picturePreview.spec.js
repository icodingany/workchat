import { expect } from 'chai'
import base64 from '@/utils/base64'
import {
  resolvePictureUrl,
  resolvePicturePreviewUrl,
  pictureMsgKey,
  safeHttpUrl,
  getPictureThumbUrl,
  isPictureDisplayUrlOriginal,
  normalizePictureUrl,
  stripImageProcessParams
} from '@/utils/picturePreview'

describe('picturePreview', () => {
  const origin = 'https://file.example.invalid/20260728/origin.jpg'
  const mid = 'https://file.example.invalid/20260728/mid.jpg'
  const thumb = 'https://file.example.invalid/20260728/thumb.jpg'

  // --------- safeHttpUrl ---------
  describe('safeHttpUrl', () => {
    it('放行 http/https 直链', () => {
      expect(safeHttpUrl(origin)).to.equal(origin)
      expect(safeHttpUrl('http://example.com/a.jpg')).to.equal('http://example.com/a.jpg')
    })
    it('拒绝非 http 与空值', () => {
      expect(safeHttpUrl('/storage/emulated/0/a.jpg')).to.equal('')
      expect(safeHttpUrl('data:image/png;base64,xyz')).to.equal('')
      expect(safeHttpUrl(null)).to.equal('')
      expect(safeHttpUrl('')).to.equal('')
      expect(safeHttpUrl(undefined)).to.equal('')
    })
  })

  // --------- resolvePictureUrl ---------
  describe('resolvePictureUrl', () => {
    it('原图 url 优先，且与 thumb 不同时标记 isOriginal', () => {
      const chat = { jContent: { url: origin, thumbUrl: thumb } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('url 为 imageView2 时剥离为 CDN 原图并标 isOriginal', () => {
      const thumbQ = origin + '?imageView2/1/w/200/h/200/q/90'
      const chat = { jContent: { url: thumbQ, thumbUrl: thumbQ } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('无 url 时降级到 midUrl，hosted 直链剥离 imageView2', () => {
      const midHosted = 'https://file.example.invalid/20260728/mid.jpg?imageView2/1/w/100'
      const chat = { jContent: { midUrl: midHosted, thumbUrl: thumb } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal('https://file.example.invalid/20260728/mid.jpg')
      expect(r.isOriginal).to.equal(true)
    })

    it('无 url 时降级到 midUrl，标记非原图', () => {
      const chat = { jContent: { midUrl: mid, thumbUrl: thumb } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(mid)
      expect(r.isOriginal).to.equal(false)
    })
    it('无原图时降级到 thumbUrl（保证点击能打开）', () => {
      const chat = { jContent: { thumbUrl: thumb } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(thumb)
      expect(r.isOriginal).to.equal(false)
    })
    it('Content 为直链时作为原图兜底（自己刚发的图）', () => {
      const chat = { Content: origin }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('Ext 里是直链时当作原图', () => {
      const chat = { jContent: { Ext: origin } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('Ext 里是 base64 编码的直链时解码后再取', () => {
      const chat = { jContent: { Ext: base64.encode(origin) } }
      const r = resolvePictureUrl(chat)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('jContent 只有本地路径（无 http）→ 无法解析', () => {
      const chat = { jContent: { url: '/storage/emulated/0/a.jpg' } }
      expect(resolvePictureUrl(chat)).to.equal(null)
    })
    it('完全无字段 → null', () => {
      expect(resolvePictureUrl({ jContent: {} })).to.equal(null)
      expect(resolvePictureUrl(null)).to.equal(null)
    })
    it('大写的 Url / ThumbUrl / cdnUrl 也兼容', () => {
      expect(resolvePictureUrl({ jContent: { Url: origin } }).url).to.equal(origin)
      expect(resolvePictureUrl({ jContent: { ThumbUrl: thumb } }).url).to.equal(thumb)
      expect(resolvePictureUrl({ jContent: { cdnUrl: origin } }).url).to.equal(origin)
    })
  })

  describe('resolvePicturePreviewUrl', () => {
    it('bigImageMap 缓存原图优先于缩略图', () => {
      const chat = { MsgId: 1, jContent: { thumbUrl: thumb } }
      const map = { 1: origin }
      const r = resolvePicturePreviewUrl(chat, map)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('缓存 URL 与缩略图相同时不标原图', () => {
      const chat = { MsgId: 1, jContent: { thumbUrl: thumb } }
      const map = { 1: thumb }
      const r = resolvePicturePreviewUrl(chat, map)
      expect(r.url).to.equal(thumb)
      expect(r.isOriginal).to.equal(false)
    })
    it('无缓存时降级 resolvePictureUrl', () => {
      const chat = { jContent: { url: origin, thumbUrl: thumb } }
      const r = resolvePicturePreviewUrl(chat, {})
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })
    it('_originalImageReady 时优先用 map 原图', () => {
      const chat = { MsgId: 2, _originalImageReady: true, jContent: { thumbUrl: thumb } }
      const map = { 2: origin }
      const r = resolvePicturePreviewUrl(chat, map)
      expect(r.url).to.equal(origin)
      expect(r.isOriginal).to.equal(true)
    })

    it('resolvePictureUrl 仅 thumb 时 preview 标非原图', () => {
      const chat = { jContent: { thumbUrl: thumb } }
      const r = resolvePicturePreviewUrl(chat, {})
      expect(r.url).to.equal(thumb)
      expect(r.isOriginal).to.equal(false)
    })
  })

  describe('isPictureDisplayUrlOriginal', () => {
    it('七牛 imageView2 不当原图', () => {
      const qiniu = 'https://cdn.example.com/a.jpg?imageView2/2/w/200'
      expect(isPictureDisplayUrlOriginal({}, qiniu, thumb)).to.equal(false)
    })
    it('file.example.invalid 直链且与 thumb 不同时视为原图', () => {
      const hosted = 'https://file.example.invalid/2026/a.jpg'
      expect(isPictureDisplayUrlOriginal({}, hosted, thumb)).to.equal(true)
    })
    it('file.example.invalid 无 thumb 时不当原图（可能是 512 缩略上传体）', () => {
      const hosted = 'https://file.example.invalid/2026/a.jpg'
      expect(isPictureDisplayUrlOriginal({}, hosted, '')).to.equal(false)
    })
  })

  describe('stripImageProcessParams', () => {
    it('去掉 imageView2 得到原图直链', () => {
      const thumbQ = origin + '?imageView2/1/w/200/h/200/q/90'
      expect(stripImageProcessParams(thumbQ)).to.equal(origin)
    })
  })

  describe('normalizePictureUrl', () => {
    it('HTTPS 页将 http 升级为 https', () => {
      const prev = global.location
      global.location = { protocol: 'https:' }
      expect(normalizePictureUrl('http://file.example.invalid/a.jpg')).to.equal(
        'https://file.example.invalid/a.jpg'
      )
      global.location = prev
    })
  })

  describe('getPictureThumbUrl', () => {
    it('取 thumbUrl / midUrl', () => {
      expect(getPictureThumbUrl({ jContent: { thumbUrl: thumb } })).to.equal(thumb)
      expect(getPictureThumbUrl({ jContent: { midUrl: mid } })).to.equal(mid)
    })
  })

  // --------- pictureMsgKey ---------
  describe('pictureMsgKey', () => {
    it('以 MsgId 为准', () => {
      expect(pictureMsgKey({ MsgId: 123, MsgSvrId: 'srv-9' })).to.equal('123')
    })
    it('无 MsgId 时回退 MsgRemoteId', () => {
      expect(pictureMsgKey({ MsgRemoteId: 'remote-9' })).to.equal('remote-9')
    })
    it('无 MsgId 时回退 MsgSvrId', () => {
      expect(pictureMsgKey({ MsgSvrId: 'srv-9' })).to.equal('srv-9')
    })
    it('字符串 MsgId 原样返回', () => {
      expect(pictureMsgKey({ MsgId: 'msg-abc' })).to.equal('msg-abc')
    })
    it('两者都无 → 空串', () => {
      expect(pictureMsgKey({})).to.equal('')
    })
  })
})