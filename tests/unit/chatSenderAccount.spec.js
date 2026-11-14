import { expect } from 'chai'
import { normalizeSenderAccountName, applySenderAccountFields } from '@/utils/chatSenderAccount'

describe('normalizeSenderAccountName', () => {
  it('prefers SenderAccountName', () => {
    expect(normalizeSenderAccountName({ SenderAccountName: 'a', sender_account_name: 'b' })).to.equal('a')
  })

  it('uses sender_account_name', () => {
    expect(normalizeSenderAccountName({ sender_account_name: 'kefu' })).to.equal('kefu')
  })

  it('uses sender_account.account', () => {
    expect(normalizeSenderAccountName({ sender_account: { account: 'kefu_ws' } })).to.equal('kefu_ws')
  })

  it('trims and ignores empty', () => {
    expect(normalizeSenderAccountName({ SenderAccountName: '  ' })).to.equal('')
  })

  it('applySenderAccountFields writes SenderAccountName', () => {
    const chat = { sender_account: { account: 'op1' } }
    applySenderAccountFields(chat)
    expect(chat.SenderAccountName).to.equal('op1')
  })
})
