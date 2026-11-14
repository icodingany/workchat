/**
 * 视频号收藏/发送：补齐手机 SphMsgBean 字段，避免 cover 丢失后变成黑块/错图且无法播放。
 */
import { expect } from 'chai'
import {
  pickSphCoverUrl,
  normalizeSphPayloadForSend,
  prepareShiPinHaoMaterialContent
} from '@/utils/shiPinHaoPayload'
import { buildResourceSend } from '@/utils/resourcePayload'
import { decodeChatHtml } from '@/utils/decodeChatHtml'
import { prepareChatViewItem } from '@/utils/prepareChatForView'

describe('shiPinHaoPayload', () => {
  it('pickSphCoverUrl 优先 cover，不把视频 url 当封面', () => {
    expect(
      pickSphCoverUrl({
        mediaList: [{ cover: 'https://cdn/cover.jpg', thumb: 'https://cdn/black.jpg' }]
      })
    ).to.equal('https://cdn/cover.jpg')
    expect(pickSphCoverUrl({ url: 'https://cdn/video.mp4', nickname: 'x' })).to.equal('')
  })

  it('normalizeSphPayloadForSend：mediaList.thumb 空 cover 时补齐 cover/url', () => {
    const payload = normalizeSphPayloadForSend({
      id: 'obj-1',
      nickname: '作者',
      des: '描述',
      title: '视频号',
      mediaList: [
        {
          cover: '',
          thumb: 'https://finder.video.qq.com/thumb.jpg',
          url: 'https://finder.video.qq.com/video.mp4',
          mediaType: 4
        }
      ]
    })
    expect(payload).to.not.equal(null)
    expect(payload.cover).to.equal('https://finder.video.qq.com/thumb.jpg')
    expect(payload.url).to.equal('https://finder.video.qq.com/video.mp4')
    expect(payload.mediaList[0].cover).to.equal('https://finder.video.qq.com/thumb.jpg')
  })

  it('prepareShiPinHaoMaterialContent 拒绝 slim 占位与缺 url', () => {
    expect(prepareShiPinHaoMaterialContent('{"slim":true,"contentType":25}')).to.equal(null)
    expect(prepareShiPinHaoMaterialContent('{"title":"视频号"}')).to.equal(null)
    const prepared = prepareShiPinHaoMaterialContent({
      Nickname: '喃喃',
      Thumb: 'https://cdn/cover.jpg',
      Des: '换代码16年再换8年',
      id: 'export/abc'
    })
    expect(prepared).to.not.equal(null)
    expect(prepared.cover).to.equal('https://cdn/cover.jpg')
    expect(prepared.nickname).to.equal('喃喃')
    expect(prepared.url).to.equal('https://cdn/cover.jpg')
  })

  it('buildResourceSend(ShiPinHao) 输出可下发 JSON，不抽成 Video url', () => {
    const mapped = buildResourceSend('ShiPinHao', {
      nickname: '作者',
      des: '描述',
      cover: 'https://cdn/cover.jpg',
      url: 'https://finder.video.qq.com/feed',
      id: 'obj-1',
      nonceId: 'nonce-1'
    })
    expect(mapped).to.not.equal(null)
    expect(mapped.type).to.equal('ShiPinHao')
    const body = JSON.parse(mapped.content)
    expect(body.url).to.equal('https://finder.video.qq.com/feed')
    expect(body.cover).to.equal('https://cdn/cover.jpg')
    expect(body.id).to.equal('obj-1')
  })

  it('buildResourceSend(ShiPinHao) 内容不完整返回 null', () => {
    expect(buildResourceSend('ShiPinHao', { title: '视频号' })).to.equal(null)
  })

  it('decodeChatHtml 视频号优先 cover，不用近黑 thumb 抢封面', () => {
    const chat = prepareChatViewItem({
      contentType: 25,
      content: JSON.stringify({
        nickname: '作者',
        des: '换代码16年再换8年',
        cover: 'https://cdn/real-cover.jpg',
        thumbUrl: 'https://cdn/black-frame.jpg'
      }),
      msgRemoteId: 'sph-1'
    })
    const html = decodeChatHtml(chat, { useCache: false })
    expect(html).to.include('视频号')
    expect(html).to.include('https://cdn/real-cover.jpg')
    expect(html).to.not.include('https://cdn/black-frame.jpg')
  })
})
