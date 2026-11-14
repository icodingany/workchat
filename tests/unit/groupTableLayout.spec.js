import { expect } from 'chai'
import { groupTableCompact, GROUP_TABLE_COMPACT_WIDTH } from '@/utils/groupTableLayout'

describe('groupTableCompact（群发表格窄容器紧凑布局）', () => {
  it('阈值 600：低于该宽度容器放不下全部列（最小 ~528px）', () => {
    expect(GROUP_TABLE_COMPACT_WIDTH).to.equal(600)
  })

  it('宽容器用完整布局', () => {
    expect(groupTableCompact(1280)).to.equal(false)
    expect(groupTableCompact(600)).to.equal(false)
  })

  it('企微侧边栏/手机 H5 等窄容器切紧凑布局', () => {
    expect(groupTableCompact(599)).to.equal(true)
    expect(groupTableCompact(377)).to.equal(true)
    expect(groupTableCompact(240)).to.equal(true)
  })

  it('非法宽度按紧凑处理（渲染瞬间兜底）', () => {
    expect(groupTableCompact(0)).to.equal(true)
    expect(groupTableCompact(null)).to.equal(true)
  })
})
