import { expect } from 'chai'
import { isReactive, reactive } from 'vue'
import { buildSlimSelectContact } from '@/utils/slimSelectContact'

describe('slimSelectContact', () => {
  it('不展开无关大字段，Members 为 markRaw', () => {
    const members = Array.from({ length: 200 }, (_, i) => ({
      RemoteId: String(i),
      Name: 'm' + i
    }))
    const message = {
      Id: '1',
      RemoteId: '100',
      Name: '群',
      Digest: 'hi',
      Members: members,
      huge: { nested: true }
    }
    const contact = buildSlimSelectContact(message, { Name: 'ignore' }, [])
    expect(contact.RemoteId).to.equal('100')
    expect(contact.Name).to.equal('群')
    expect(contact.huge).to.equal(undefined)
    expect(contact.Members).to.have.length(200)
    const wrapped = reactive({ contact })
    expect(isReactive(wrapped.contact.Members)).to.equal(false)
  })
})
