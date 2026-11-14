/**
 * 我的朋友圈 store（circle.js）单元测试
 * 覆盖：首屏替换 / 分页去重追加 / 单条详情回写
 */
import { expect } from 'chai'
import circleModule, { sameId, dedupeAppend } from '@/store/modules/circle'

function freshState() {
  return JSON.parse(JSON.stringify(circleModule.state))
}

describe('circle store helpers', () => {
  it('sameId 兼容 number / string', () => {
    expect(sameId(100, '100')).to.equal(true)
    expect(sameId(100, 101)).to.equal(false)
    expect(sameId(null, 1)).to.equal(false)
  })

  it('dedupeAppend 按 SnsId 去重', () => {
    const existing = [{ SnsId: 1, Content: 'a' }]
    const incoming = [
      { SnsId: 1, Content: 'a-dup' },
      { SnsId: '2', Content: 'b' }
    ]
    const merged = dedupeAppend(existing, incoming)
    expect(merged).to.have.length(2)
    expect(merged[0].Content).to.equal('a')
    expect(merged[1].SnsId).to.equal('2')
  })
})

describe('circle SetCircles / UPDATE_CIRCLES_BY_ONE', () => {
  it('replace 模式整表替换，不 concat', () => {
    const state = freshState()
    state.circles = {
      SnsList: [{ SnsId: 1, Content: 'old' }],
      WxId: 10,
      NextSeq: 99,
      Success: true
    }
    state.pullMode = 'replace'

    circleModule.actions.SetCircles(
      { state, commit: (type, payload) => circleModule.mutations[type](state, payload) },
      {
        WxId: 10,
        NextSeq: 100,
        Success: true,
        SnsList: [
          { SnsId: 1, Content: '我们的公众号', Images: [{ ThumbImg: 'http://a' }] },
          { SnsId: 2, Content: '另一条' }
        ]
      }
    )

    expect(state.circles.SnsList).to.have.length(2)
    expect(state.circles.SnsList[0].Images[0].ThumbImg).to.equal('http://a')
    expect(state.circles.NextSeq).to.equal(100)
  })

  it('append 模式按 NextSeq 追加并去重，避免首屏重拉重复', () => {
    const state = freshState()
    state.circles = {
      SnsList: [
        { SnsId: 1, Content: '我们的公众号', Images: [{ ThumbImg: '' }] },
        { SnsId: 2, Content: '好用的勒' }
      ],
      WxId: 10,
      NextSeq: 50,
      Success: true
    }
    state.pullMode = 'append'

    const commit = (type, payload) => circleModule.mutations[type](state, payload)
    circleModule.actions.SetCircles(
      { state, commit },
      {
        WxId: 10,
        NextSeq: 80,
        Success: true,
        SnsList: [
          { SnsId: 1, Content: '我们的公众号', Images: [{ ThumbImg: 'http://ok' }] },
          { SnsId: 3, Content: '新的' }
        ]
      }
    )

    expect(state.circles.SnsList).to.have.length(3)
    expect(state.circles.SnsList.map((s) => s.SnsId)).to.deep.equal([1, 2, 3])
    // 已存在的不覆盖，避免把已展示的刷成无图重复项
    expect(state.circles.SnsList[0].Images[0].ThumbImg).to.equal('')
  })

  it('UPDATE_CIRCLES_BY_ONE 按 SnsId 回写缩略图', () => {
    const state = freshState()
    state.circles = {
      SnsList: [{ SnsId: 1001, Content: '我们的公众号', Images: [{ ThumbImg: '' }] }],
      WxId: 10,
      NextSeq: 1,
      Success: true
    }

    circleModule.mutations.UPDATE_CIRCLES_BY_ONE(state, {
      WxId: 10,
      Success: true,
      TaskId: 1001,
      SnsInfo: {
        SnsId: 1001,
        Content: '我们的公众号',
        Images: [{ ThumbImg: 'http://thumb' }]
      }
    })

    expect(state.circles.SnsList).to.have.length(1)
    expect(state.circles.SnsList[0].Images[0].ThumbImg).to.equal('http://thumb')
  })

  it('UPDATE_CIRCLES_BY_ONE 旧 bug（findId.TaskId）不得再漏更', () => {
    const state = freshState()
    state.circles = {
      SnsList: [{ SnsId: 7, Content: 'x', Images: [{ ThumbImg: null }] }],
      WxId: '10',
      NextSeq: 1,
      Success: true
    }

    circleModule.mutations.UPDATE_CIRCLES_BY_ONE(state, {
      WxId: '10',
      Success: true,
      TaskId: 7,
      SnsInfo: { SnsId: 7, Content: 'x', Images: [{ ThumbImg: 'ok.png' }] }
    })

    expect(state.circles.SnsList[0].Images[0].ThumbImg).to.equal('ok.png')
  })
})
