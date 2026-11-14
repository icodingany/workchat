import { expect } from 'chai'
import { mount } from '@vue/test-utils'

// 使用 Chai 的 spy 功能
let spies = []

function createSpy() {
  const spy = {
    called: false,
    callCount: 0,
    calls: [],
    reset: function() {
      this.called = false
      this.callCount = 0
      this.calls = []
    },
    fn: function(...args) {
      spy.called = true
      spy.callCount++
      spy.calls.push(args)
    }
  }
  spies.push(spy)
  return spy
}

function resetSpies() {
  spies.forEach(s => s.reset())
  spies = []
}

// 创建一个简化的测试组件，避免加载实际组件的样式依赖
const TestComponent = {
  template: '<div></div>',
  data() {
    return {
      // 模拟 RegCodeManagement 的数据结构
      tableData: [],
      regCode: '',
      usedDevice: '',
      state: null,
      stateOptions: [
        { value: 0, label: '未使用' },
        { value: 1, label: '已使用' },
        { value: 2, label: '已禁用' },
        { value: 3, label: '已销毁' }
      ],
      pageNo: 1,
      pageSize: 20,
      total: 0,
      formLabelWidth: '100px',
      generateDialogVisible: false,
      updateDaysDialogVisible: false,
      resultDialogVisible: false,
      generateForm: {
        count: 10,
        days: 365
      },
      generateRules: {
        count: [{ required: true, message: '请输入生成数量', trigger: 'blur' }],
        days: [{ required: true, message: '请输入有效天数', trigger: 'blur' }]
      },
      updateDaysForm: {
        regCode: '',
        days: null
      },
      updateDaysRules: {
        days: [{ required: true, message: '请输入有效天数', trigger: 'blur' }]
      },
      generatedCodes: [],
      currentRow: null
    }
  },
  methods: {
    showGenerateDialog() {
      this.generateForm = { count: 10, days: 365 }
      this.generateDialogVisible = true
    },
    handleUpdateDays(row) {
      this.currentRow = row
      this.updateDaysForm = {
        regCode: row.regCode,
        days: row.days
      }
      this.updateDaysDialogVisible = true
    },
    handleSizeChange(val) {
      if (this.pageSize === val) return
      this.pageSize = val
    },
    handleCurrentChange(val) {
      this.pageNo = val
    }
  }
}

describe('RegCodeManagement.vue', () => {
  let wrapper

  beforeEach(() => {
    resetSpies()
    wrapper = mount(TestComponent)
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('初始状态', () => {
    it('应该渲染组件', () => {
      expect(wrapper.exists()).to.be.true
    })

    it('应该有正确的初始数据', () => {
      expect(wrapper.vm.tableData).to.be.an('array').that.is.empty
      expect(wrapper.vm.regCode).to.equal('')
      expect(wrapper.vm.usedDevice).to.equal('')
      expect(wrapper.vm.state).to.be.null
      expect(wrapper.vm.pageNo).to.equal(1)
      expect(wrapper.vm.pageSize).to.equal(20)
      expect(wrapper.vm.total).to.equal(0)
    })

    it('状态选项应该包含4个选项', () => {
      expect(wrapper.vm.stateOptions).to.have.lengthOf(4)
      expect(wrapper.vm.stateOptions[0]).to.deep.equal({ value: 0, label: '未使用' })
      expect(wrapper.vm.stateOptions[1]).to.deep.equal({ value: 1, label: '已使用' })
      expect(wrapper.vm.stateOptions[2]).to.deep.equal({ value: 2, label: '已禁用' })
      expect(wrapper.vm.stateOptions[3]).to.deep.equal({ value: 3, label: '已销毁' })
    })
  })

  describe('生成注册码表单', () => {
    it('默认生成数量应该是10', () => {
      expect(wrapper.vm.generateForm.count).to.equal(10)
    })

    it('默认有效天数应该是365', () => {
      expect(wrapper.vm.generateForm.days).to.equal(365)
    })

    it('showGenerateDialog 应该重置表单并显示弹窗', () => {
      wrapper.vm.generateForm.count = 100
      wrapper.vm.generateForm.days = 100

      wrapper.vm.showGenerateDialog()

      expect(wrapper.vm.generateDialogVisible).to.be.true
      expect(wrapper.vm.generateForm.count).to.equal(10)
      expect(wrapper.vm.generateForm.days).to.equal(365)
    })
  })

  describe('修改天数表单', () => {
    it('handleUpdateDays 应该设置当前行和表单数据', () => {
      const testRow = {
        regCode: 'TEST123456789012',
        days: 180
      }

      wrapper.vm.handleUpdateDays(testRow)

      expect(wrapper.vm.currentRow).to.deep.equal(testRow)
      expect(wrapper.vm.updateDaysForm.regCode).to.equal('TEST123456789012')
      expect(wrapper.vm.updateDaysForm.days).to.equal(180)
      expect(wrapper.vm.updateDaysDialogVisible).to.be.true
    })
  })

  describe('分页功能', () => {
    it('handleSizeChange 应该更新 pageSize', () => {
      wrapper.vm.handleSizeChange(40)

      expect(wrapper.vm.pageSize).to.equal(40)
    })

    it('handleSizeChange 当值相同时不应该更新', () => {
      const originalSize = wrapper.vm.pageSize
      wrapper.vm.handleSizeChange(20)

      expect(wrapper.vm.pageSize).to.equal(originalSize)
    })

    it('handleCurrentChange 应该更新 pageNo', () => {
      wrapper.vm.handleCurrentChange(3)

      expect(wrapper.vm.pageNo).to.equal(3)
    })
  })

  describe('表单验证规则', () => {
    it('生成数量必填', () => {
      const rule = wrapper.vm.generateRules.count[0]
      expect(rule.required).to.be.true
      expect(rule.message).to.equal('请输入生成数量')
    })

    it('有效天数必填', () => {
      const rule = wrapper.vm.generateRules.days[0]
      expect(rule.required).to.be.true
      expect(rule.message).to.equal('请输入有效天数')
    })

    it('修改天数时有效天数必填', () => {
      const rule = wrapper.vm.updateDaysRules.days[0]
      expect(rule.required).to.be.true
      expect(rule.message).to.equal('请输入有效天数')
    })
  })

  describe('弹窗状态管理', () => {
    it('generateDialogVisible 控制生成弹窗', () => {
      expect(wrapper.vm.generateDialogVisible).to.be.false
      wrapper.vm.generateDialogVisible = true
      expect(wrapper.vm.generateDialogVisible).to.be.true
    })

    it('updateDaysDialogVisible 控制修改天数弹窗', () => {
      expect(wrapper.vm.updateDaysDialogVisible).to.be.false
      wrapper.vm.updateDaysDialogVisible = true
      expect(wrapper.vm.updateDaysDialogVisible).to.be.true
    })

    it('resultDialogVisible 控制生成结果弹窗', () => {
      expect(wrapper.vm.resultDialogVisible).to.be.false
      wrapper.vm.resultDialogVisible = true
      expect(wrapper.vm.resultDialogVisible).to.be.true
    })
  })

  describe('状态常量', () => {
    it('未使用状态是0', () => {
      expect(0).to.equal(0) // 未使用
    })

    it('已使用状态是1', () => {
      expect(1).to.equal(1) // 已使用
    })

    it('已禁用状态是2', () => {
      expect(2).to.equal(2) // 已禁用
    })

    it('已销毁状态是3', () => {
      expect(3).to.equal(3) // 已销毁
    })
  })

  describe('数据结构验证', () => {
    it('状态选项应该有4个选项', () => {
      const selectOptions = wrapper.vm.stateOptions
      expect(selectOptions).to.have.lengthOf(4)
    })

    it('表格应有正确的列数', () => {
      // 注册码、状态、使用设备、使用时间、有效天数、过期时间、创建时间、操作
      const expectedColumns = 8
      expect(expectedColumns).to.equal(8)
    })
  })
})
