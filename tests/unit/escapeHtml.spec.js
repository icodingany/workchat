import { expect } from 'chai'
import { escapeHtml } from '@/utils/escapeHtml'
import { decodeChatHtml } from '@/utils/decodeChatHtml'
import { prepareChatViewItem } from '@/utils/prepareChatForView'

describe('escapeHtml', () => {
  it('转义 HTML 特殊字符', () => {
    expect(escapeHtml('<script>alert(1)</script>')).to.equal('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('a & b')).to.equal('a &amp; b')
  })

  it('decodeChatHtml Link title 走 escapeHtml', () => {
    const chat = prepareChatViewItem({
      contentType: 6,
      content: '{"title":"<b>x</b>","desc":"d"}',
      msgRemoteId: 'xss1'
    })
    const html = decodeChatHtml(chat, { useCache: false })
    expect(html).to.include('&lt;b&gt;x&lt;/b&gt;')
    expect(html).not.to.include('<b>x</b>')
  })
})
