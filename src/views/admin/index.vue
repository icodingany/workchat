<template>
  <div class="admin-page">
    <!-- 侧栏顶到头：横向容器 = 侧栏 |（顶栏 + 内容），对齐 kelailaichatpc -->
    <el-container class="el-container" direction="horizontal">
      <!-- 客徕徕内嵌（SSO）时隐藏本端侧栏：菜单由宿主提供，经 ?nav= 深链定位 -->
      <ul v-if="!ssoEmbedded" class="navs-list scroll">
        <template v-for="(nav, index) in adminNavs" :key="'nav-' + index">
          <li
            v-if="!nav.children"
            :key="'nav-' + index"
            class="aside-nav can-not-select"
            :class="{ 'nav-chose': currentNav === nav.navPath }"
            @click="setNav(nav)"
          >
            <i class="fa-lg" :class="nav.navIcon"></i>
            <span v-text="nav.navName"></span>
          </li>
          <li v-else :key="'group-' + index" class="aside-group">
            <div class="aside-nav aside-group-title can-not-select" @click="toggleGroup(nav)">
              <i class="fa-lg" :class="nav.navIcon"></i>
              <span v-text="nav.navName"></span>
              <i class="el-icon-arrow-down group-caret" :class="{ open: nav.isOpen }"></i>
            </div>
            <ul v-show="nav.isOpen" class="aside-sub-list">
              <li
                v-for="(sub, sIdx) in nav.children"
                :key="'sub-' + index + '-' + sIdx"
                class="aside-nav aside-sub can-not-select"
                :class="{ 'nav-chose': currentNav === sub.navPath }"
                @click="setNav(sub)"
              >
                <span v-text="sub.navName"></span>
              </li>
            </ul>
          </li>
        </template>
      </ul>
      <el-main class="main-page">
        <el-header v-if="!ssoEmbedded" :height="'64px'" class="header-page" style="-webkit-app-region: drag">
          <div class="header-spacer"></div>
          <app-mode-switch theme="light" style="-webkit-app-region: no-drag"></app-mode-switch>
          <!-- 客徕徕内嵌企微 tab（SSO 登录）下隐藏，身份由宿主壳展示 -->
          <el-dropdown v-if="!ssoEmbedded" class="my-el-dropdown" style="-webkit-app-region: no-drag" @command="handleCommand">
            <div class="el-dropdown-link">
              <img class="user-brand-mark" src="../../assets/images/header/brand-mark-bubble-k.svg" alt="" />
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
          <div v-if="isDesktop" style="-webkit-app-region: no-drag" class="menu">
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
        </el-header>
        <div class="right-content">
          <component :is="currentNav"></component>
        </div>
        <el-dialog title="修改密码" v-model="modifyPwdDialog" class="pwd-dialog">
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
      </el-main>
    </el-container>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { defineAsyncComponent } from 'vue'
import { editPassword, queryIdentityConfig } from '@/api/httpApiAdmin'
import AppModeSwitch from '@/components/AppModeSwitch.vue'
import { getAdminNavigation } from '@/config/navigation'
import { isSsoEmbedded, clearSsoEmbedded } from '@/utils/ssoEmbedded'
import { resolveNavFromQuery } from '@/utils/adminNavFromQuery'

const accountManagement = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/AccountManagement'))
const commonReplies = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/CommonReplies'))
const commonTags = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/CommonTags'))
const phonesManagement = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/PhonesManagement'))
const customerManagement = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/SuperCustomerManagement'))
const phonesManagementSuper = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/SuperPhonesManagement'))
const regCodeManagement = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/RegCodeManagement'))
const friendList = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/FriendList.vue'))
const chatRoomList = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/ChatRoomList.vue'))
const newFriendAutoReply = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/NewFriendAutoReply.vue'))
const scheduledMassMessage = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/ScheduledMassMessage.vue'))
const scheduledMoments = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/ScheduledMoments.vue'))
const materialLibrary = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ '../tools/components/MaterialLibrary.vue'))

// const versionControl = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/VersionControl'))
// const messageLog = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/MessageLog'))
// const mobilePhoneMonitor = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/MobilePhoneMonitor'))
// const dataStatistics = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ './components/DataStatistics'))

export default {
  components: {
    AppModeSwitch,
    accountManagement,
    commonReplies,
    commonTags,
    phonesManagement,
    customerManagement,
    phonesManagementSuper,
    regCodeManagement,
    friendList,
    chatRoomList,
    newFriendAutoReply,
    scheduledMassMessage,
    scheduledMoments,
    materialLibrary
    // versionControl,
    // messageLog,
    // mobilePhoneMonitor,
    // dataStatistics
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
      modifyPwdDialog: false, // 展示修改密码
      // 密码由个微（客徕徕）统一管理时隐藏本端修改密码入口（对齐 AccountManagement 门控）
      identityManaged: false,
      formLabelWidth: '80px', // 展示修改密码
      form: {
        oldPwd: '',
        newPwd: ''
      }, // 密码表单
      rules: {
        oldPwd: [{ validator: validateOldPwd, trigger: 'blur' }],
        newPwd: [{ validator: validateNewPwd, trigger: 'blur' }]
      }, // 密码校验
      // 菜单由 watch(superAdmin) 重建；分组 isOpen 需可变，故用 data 而非纯 computed
      adminNavs: [],
      currentNav: ''
    }
  },
  computed: {
    ...mapState({
      adminInfo: 'adminInfo',
      currentMode: 'currentMode'
    }),
    ...mapGetters({
      superAdmin: 'superAdmin', // 超级管理员
      isDesktop: 'isDesktop'
    }),
    /** 与客服端 HeaderPage 一致：优先 nickname，不用 account */
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
  watch: {
    // superAdmin 可能在 adminInfo/httpToken 就绪后才变 true；created 一次性构建会把超管锁在公司菜单
    superAdmin: {
      immediate: true,
      handler() {
        this.rebuildAdminNavs()
      }
    }
  },
  mounted() {
    // 客徕徕内嵌深链：#/admin?nav=<navPath>（或 SSO 前由 LoginPage 暂存）定位到指定管理页
    const hit = resolveNavFromQuery(this.$route.query, { superAdmin: this.superAdmin })
    if (hit) this.currentNav = hit.navPath
    // 密码由客徕徕统一管理（身份托管）时隐藏修改密码入口；查询失败不阻塞管理端
    queryIdentityConfig()
      .then((res) => {
        if (res && res.code === 0 && res.data && res.data.managedExternally) {
          this.identityManaged = true
        }
      })
      .catch(() => {})
  },
  methods: {
    rebuildAdminNavs() {
      this.adminNavs = getAdminNavigation(this.superAdmin)
      const paths = []
      this.adminNavs.forEach((nav) => {
        if (nav.navPath) paths.push(nav.navPath)
        if (nav.children) nav.children.forEach((c) => c.navPath && paths.push(c.navPath))
      })
      if (!paths.includes(this.currentNav)) {
        const first = this.adminNavs[0]
        this.currentNav =
          (first && first.navPath) ||
          (first && first.children && first.children[0] && first.children[0].navPath) ||
          ''
      }
    },
    // 处理下拉菜单
    handleCommand(command) {      switch (command) {
        case 'logout':
          // 退出之前需要二次确认
          this.$confirm('你将退出登录 ?', '提示', {
            closeOnClickModal: false,
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
            .catch(() => {
              this.$message({
                type: 'info',
                message: '已取消'
              })
            })
          break
        case 'modifyPwd':
          this.modifyPwdDialog = true
          break
        default:
          this.$message('click on item ' + command)
          break
      }
    },
    // 修改密码
    modifyPwd() {
      this.$refs['ruleForm'].validate((valid) => {
        if (valid) {
          const id = this.adminInfo.id
          editPassword(id, this.form.oldPwd, this.form.newPwd).then((res) => {
            if (res.code === 0) {
              this.modifyPwdDialog = false
              this.$message({
                type: 'success',
                message: '修改密码成功!',
                duration: 1000
              })
            }
          })
        } else {
          return false
        }
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
    },
    // ======================
    // 设置当前的nav
    setNav(nav) {
      if (!nav || !nav.navPath) return
      this.currentNav = nav.navPath
    },
    toggleGroup(nav) {
      nav.isOpen = !nav.isOpen
    }
  }
}
</script>

<style lang="scss" scoped>
.admin-page {
  width: 100%;
  height: 100%;

  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  background-color: #fff;
  border: solid #c3c3c3 1px;

  display: flex;
  flex-direction: column;
}

.el-container {
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;

  .navs-list {
    width: 150px;
    min-width: 150px;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: solid #c3c3c3 1px;
    background-color: $admin-sidebar-bg;
    display: flex;
    flex-direction: column;
    .aside-nav {
      padding: 16px 10px;
      color: $admin-sidebar-text;
      cursor: pointer;
      &:hover {
        background-color: $admin-sidebar-hover;
        color: #fff;
      }
      .fa-lg {
        margin-right: 5px;
      }
    }
    .aside-group {
      list-style: none;
      .aside-group-title {
        display: flex;
        align-items: center;
        .group-caret {
          margin-left: auto;
          transition: transform 0.15s;
          &.open {
            transform: rotate(180deg);
          }
        }
      }
      .aside-sub-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .aside-sub {
        padding-left: 28px;
        font-size: 13px;
      }
    }
    .nav-chose {
      background: $admin-sidebar-hover;
      color: $admin-sidebar-active;
      &:hover {
        background: $admin-sidebar-hover;
        color: $admin-sidebar-active;
      }
    }
  }

  .main-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    min-height: 0;
    padding: 0;

    .header-page {
      display: flex;
      align-items: center;
      height: 64px;
      min-height: 64px;
      border-bottom: solid #c3c3c3 1px;
      padding: 0 12px;
      .header-spacer {
        flex: 1 1 auto;
      }
      .my-el-dropdown {
        .el-dropdown-link {
          display: flex;
          align-items: center;
          color: #333333;
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
            border: solid #606266 1px;
          }
          .smaller {
            width: 10px;
            border: solid #606266 1px;
          }
          &:hover {
            background: #c3c3c3;
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
            background: #606266;
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
            background: #606266;
            transform: rotate(270deg);
          }
          &:hover {
            background: red;
            .close,
            .close:after {
              background: #fff;
            }
          }
        }
      }
    }

    .right-content {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 5px;
    }

    /* 仅限修改密码弹窗：此前裸 .el-dialog 500px 会泄漏到管理端所有弹窗，
       把「新增群发消息」800px 弹窗压成 500px，接收人表格被挤扁（2026-09-01） */
    :deep(.el-dialog.pwd-dialog) {
      width: 500px;
    }
  }
}
</style>
