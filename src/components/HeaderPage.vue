<template>
  <el-header :height="'60px'" class="header-page" style="-webkit-app-region: drag">
    <!-- 导航 -->
    <ul class="nav-ul">
      <li
        class="nav-li"
        style="-webkit-app-region: no-drag"
        :class="{ 'active-nav': $route.path === nav.navPath }"
        v-for="(nav, index) in navs"
        :key="index"
        @click="showPath(nav)"
      >
        <i :class="nav.navIcon" aria-hidden="true"></i>
        <span class="nav-name can-not-select" v-text="nav.navName"></span>
      </li>
    </ul>
    <!-- 客服端 / 管理端切换 -->
    <app-mode-switch theme="light" style="-webkit-app-region: no-drag"></app-mode-switch>
    <!-- 下拉菜单（对齐 kelailaichatpc：修改密码 / 退出系统）；客徕徕内嵌企微 tab 下隐藏，身份由宿主壳展示 -->
    <el-dropdown v-if="!ssoEmbedded" class="my-el-dropdown" @command="handleCommand" style="-webkit-app-region: no-drag">
      <div class="el-dropdown-link">
        <img class="user-brand-mark" src="../assets/images/header/brand-mark-bubble-k.svg" alt="" />
        <span class="nick-name can-not-select" v-text="displayNickName"></span>
        <i class="el-icon-arrow-down user-menu-caret" aria-hidden="true"></i>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="!identityManaged" command="modifyPwd">
            <i class="el-icon-edit"></i>
            修改密码
          </el-dropdown-item>
          <el-dropdown-item command="logout">
            <i class="fa fa-sign-out" aria-hidden="true"></i>
            退出系统
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <!--electron 最大|最小|关闭 -->
    <div style="-webkit-app-region: no-drag" class="menu" v-if="$store.getters.isDesktop">
      <div class="icon-smaller" @click="minimizeWindow()">
        <hr class="smaller" />
      </div>
      <div class="icon-bigger" @click="maximizeWindow()">
        <div class="bigger"></div>
      </div>
      <div class="icon-close" @click="hiddenWindow()">
        <div class="close"></div>
      </div>
    </div>
    <el-dialog title="修改密码" v-model="modifyPwdDialog" append-to-body>
      <el-form ref="ruleForm" :model="form" :rules="rules">
        <el-form-item label="老密码" :label-width="formLabelWidth" prop="oldPwd" required>
          <el-input
            v-model="form.oldPwd"
            type="password"
            autocomplete="off"
            clearable
            show-password
            placeholder="请输入老的密码"
            minlength="6"
            maxlength="16"
          ></el-input>
        </el-form-item>
        <el-form-item label="新密码" :label-width="formLabelWidth" prop="newPwd" required>
          <el-input
            v-model="form.newPwd"
            type="password"
            autocomplete="off"
            clearable
            placeholder="请输入新的密码"
            show-password
            minlength="6"
            maxlength="16"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div>
          <el-button @click="modifyPwdDialog = false">取 消</el-button>
          <el-button type="primary" @click="modifyPwd">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </el-header>
</template>

<script>
import { mapState } from 'vuex'
import AppModeSwitch from '@/components/AppModeSwitch.vue'
import { editPassword, queryIdentityConfig } from '@/api/httpApiAdmin'
import { clientNavigation } from '@/config/navigation'
import { isSsoEmbedded, clearSsoEmbedded } from '@/utils/ssoEmbedded'

export default {
  name: 'HeaderPage',
  components: {
    AppModeSwitch
  },
  data() {
    const validateOldPwd = (rule, value, callback) => {
      const reg = /^[0-9a-z]{6,16}$/gi
      if (reg.test(value)) {
        callback()
      } else {
        callback(new Error('密码长度6-16位,必须是数字或字母!'))
      }
    }
    const validateNewPwd = (rule, value, callback) => {
      const reg = /^[0-9a-z]{6,16}$/gi
      if (reg.test(value)) {
        if (value === this.form.oldPwd) {
          callback(new Error('新密码不能和老密码一样!'))
        }
        callback()
      } else {
        callback(new Error('请输入新密码'))
      }
    }
    return {
      modifyPwdDialog: false,
      // 密码由个微（客徕徕）统一管理时隐藏本端修改密码入口（对齐 AccountManagement 门控）
      identityManaged: false,
      formLabelWidth: '80px',
      form: {
        oldPwd: '',
        newPwd: ''
      },
      rules: {
        oldPwd: [{ validator: validateOldPwd, trigger: 'blur' }],
        newPwd: [{ validator: validateNewPwd, trigger: 'blur' }]
      },
      navs: clientNavigation.map((nav) => ({
        navName: nav.name,
        navIcon: nav.icon,
        navPath: nav.path
      }))
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo'
    }),
    /** 顶栏展示昵称：优先 HTTP 登录 nickname，其次 WS Extra；不用 account */
    displayNickName() {
      const fromHttp = this.adminInfo && this.adminInfo.nickname
      if (fromHttp) return fromHttp
      const u = this.$store.getters.currentUser
      return (u && (u.NickName || u.nickName)) || ''
    },
    /** 客徕徕内嵌企微 tab（SSO 登录）时不展示本端头像昵称/修改密码下拉 */
    ssoEmbedded() {
      return isSsoEmbedded()
    }
  },
  created() {
    // 密码由客徕徕统一管理（身份托管）时隐藏修改密码入口；查询失败不阻塞顶栏
    queryIdentityConfig()
      .then((res) => {
        if (res && res.code === 0 && res.data && res.data.managedExternally) {
          this.identityManaged = true
        }
      })
      .catch(() => {})
  },
  methods: {
    // 路由跳转
    showPath(nav) {
      if (this.$route.path === nav.navPath) return
      this.$router.push({ path: nav.navPath })
    },
    // 处理下拉菜单
    handleCommand(command) {
      switch (command) {
        case 'logout':
          this.$confirm('你将退出登录 ?', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })
            .then(() => {
              this.$store.dispatch('websocket/AccountLogoutNotice')
              this.$store.commit('SET_ADMIN_INO', null)
              this.$store.commit('SET_HTTP_TOKEN', '')
              localStorage.removeItem('httpToken')
              this.$store.commit('SET_WEBSOCKET_TOKEN', '')
              clearSsoEmbedded()
              try {
                sessionStorage.removeItem('sessionNameOfJuboChat')
                sessionStorage.removeItem('sessionPwdOfJuboChat')
              } catch (e) {
                /* ignore */
              }
              window.location.reload()
            })
            .catch(() => {})
          break
        case 'modifyPwd':
          if (!this.adminInfo || !this.adminInfo.id) {
            this.$message.warning('当前未登录管理账号，无法修改密码')
            return
          }
          this.modifyPwdDialog = true
          break
        default:
          break
      }
    },
    modifyPwd() {
      this.$refs['ruleForm'].validate((valid) => {
        if (!valid) return false
        const id = this.adminInfo.id
        editPassword(id, this.form.oldPwd, this.form.newPwd).then((res) => {
          if (res.code === 0) {
            this.modifyPwdDialog = false
            this.$refs['ruleForm'].resetFields()
            this.$message({
              type: 'success',
              message: '修改密码成功!',
              duration: 1000
            })
          }
        })
      })
    },
    // 最小化
    minimizeWindow() {
      this.$ipcRenderer.send('operations', 'min')
    },
    // 最大化
    maximizeWindow() {
      this.$ipcRenderer.send('operations', 'max')
    },
    // 自定义窗口操作
    hiddenWindow() {
      this.$ipcRenderer.send('operations', 'hidden')
    }
  }
}
</script>

<style lang="scss" scoped>
.header-page {
  display: flex;
  align-items: center;
  height: 60px;
  background: linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%);
  border-bottom: solid $border-color-base 1px;
  /* 左上角 logo 贴边，与 kelailaichatpc 顶栏一致 */
  padding: 0 12px 0 8px;

  .nav-ul {
    color: $font-color-1;
    display: flex;
    flex: 1 1 auto;
    gap: 4px;
    .nav-li {
      padding: 6px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      transition: all 0.15s ease;
      .fa {
        height: 26px;
        width: 26px;
        text-align: center;
        line-height: 26px;
        color: $font-color-2;
      }
      .nav-name {
        font-size: 13px;
        margin-top: 2px;
      }
      &:hover {
        cursor: pointer;
        background: #fff;
        color: #e6a23c;
        box-shadow: 0 0 0 1px rgba(255, 159, 0, 0.2);
        .fa {
          color: $accent-nav;
        }
      }
    }
    .active-nav {
      background: #fff;
      color: #e6a23c;
      box-shadow:
        0 0 0 1px rgba(255, 159, 0, 0.35),
        0 2px 6px rgba(255, 159, 0, 0.12);
      .fa {
        color: $accent-nav;
        background: $accent-nav-bg;
        border-radius: 8px;
      }
    }
  }

  .my-el-dropdown {
    .el-dropdown-link {
      display: flex;
      align-items: center;
      color: $font-color-base;
      text-align: center;
      cursor: pointer;
      padding: 4px 8px 4px 4px;
      border-radius: 6px;
      .user-brand-mark {
        width: 26px;
        height: 26px;
        flex-shrink: 0;
        object-fit: contain;
      }
      .nick-name {
        font-size: 14px;
        margin: 0 4px 0 6px;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-menu-caret {
        font-size: 12px;
        color: #606266;
        flex-shrink: 0;
        margin-left: 2px;
      }
    }
  }

  .menu {
    width: 100px;
    height: 20px;
    display: flex;
    align-items: center;
    margin-left: 20px;
    justify-content: space-between;
    .icon-smaller,
    .icon-bigger {
      width: 20px;
      height: 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      cursor: pointer;
      .bigger {
        width: 10px;
        height: 10px;
        border: solid $font-color-2 1px;
      }
      .smaller {
        width: 10px;
        border: solid $font-color-2 1px;
      }
      &:hover {
        background: #e4e7ed;
      }
    }
    .icon-close {
      width: 20px;
      height: 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      cursor: pointer;
      .close {
        position: relative;
        width: 2px;
        height: 15px;
        background: $font-color-2;
        transform: rotate(45deg);
        display: inline-block;
      }
      .close:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 2px;
        height: 15px;
        background: $font-color-2;
        transform: rotate(270deg);
      }
      &:hover {
        background: #f56c6c;
        .close,
        .close:after {
          background: #fff;
        }
      }
    }
  }

  :deep(.el-dialog) {
    width: 500px;
  }
}
</style>
