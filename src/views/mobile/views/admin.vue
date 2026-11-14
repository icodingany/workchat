<template>
  <div class="mobile-admin">
    <div class="admin-top">
      <div class="admin-user-row">
        <div class="admin-user-info">
          <div class="admin-user-name">{{ displayName }}</div>
          <div class="admin-user-role">{{ roleLabel }}</div>
        </div>
        <AppModeSwitch theme="dark" />
      </div>
    </div>

    <main class="admin-content">
      <template v-for="group in adminNavs" :key="group.navName">
        <van-cell-group v-if="group.children" inset :title="group.navName" class="menu-section">
          <van-cell
            v-for="item in group.children"
            :key="item.navPath"
            class="menu-item"
            :title="item.navName"
            is-link
            @click="openFeature(item)"
          />
        </van-cell-group>
        <van-cell-group v-else inset class="menu-section">
          <van-cell class="menu-item" is-link @click="openFeature(group)">
            <template #title>
              <span class="menu-item-title">
                <i v-if="group.navIcon" :class="group.navIcon" class="menu-icon" aria-hidden="true"></i>
                <span>{{ group.navName }}</span>
              </span>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <van-cell-group inset class="menu-section account-section">
        <van-cell v-if="!identityManaged" class="menu-item" title="修改密码" is-link @click="modifyPwdDialog = true" />
        <van-cell class="menu-item danger" title="退出登录" clickable @click="handleLogout" />
      </van-cell-group>
    </main>

    <van-dialog
      v-model:show="modifyPwdDialog"
      title="修改密码"
      show-cancel-button
      :before-close="onPwdDialogClose"
    >
      <van-form ref="passwordForm" class="password-form">
        <van-field
          v-model="form.oldPwd"
          type="password"
          label="旧密码"
          placeholder="请输入旧密码"
          :rules="[{ required: true, message: '请输入旧密码' }]"
        />
        <van-field
          v-model="form.newPwd"
          type="password"
          label="新密码"
          placeholder="6-16 位数字或字母"
          :rules="[{ validator: passwordValidator, message: '密码为 6-16 位数字或字母' }]"
        />
      </van-form>
    </van-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { editPassword, queryIdentityConfig } from '@/api/httpApiAdmin'
import AppModeSwitch from '@/components/AppModeSwitch.vue'
import { getAdminNavigation } from '@/config/navigation'
import { mapState } from 'vuex'

export default {
  name: 'MobileAdmin',
  components: { AppModeSwitch },
  data() {
    return {
      modifyPwdDialog: false,
      // 密码由个微（客徕徕）统一管理时隐藏本端修改密码入口（对齐 AccountManagement 门控）
      identityManaged: false,
      form: { oldPwd: '', newPwd: '' }
    }
  },
  created() {
    // 密码由客徕徕统一管理（身份托管）时隐藏修改密码入口；查询失败不阻塞页面
    queryIdentityConfig()
      .then((res) => {
        if (res && res.code === 0 && res.data && res.data.managedExternally) {
          this.identityManaged = true
        }
      })
      .catch(() => {})
  },
  computed: {
    ...mapGetters(['superAdmin']),
    ...mapState({
      adminInfo: 'adminInfo'
    }),
    adminNavs() {
      return getAdminNavigation(this.superAdmin)
    },
    displayName() {
      return (this.adminInfo && (this.adminInfo.nickname || this.adminInfo.account)) || '管理员'
    },
    roleLabel() {
      return this.superAdmin ? '超级管理员' : '管理员'
    }
  },
  methods: {
    passwordValidator(val) {
      return /^[0-9a-z]{6,16}$/i.test(val || '')
    },
    openFeature(item) {
      this.$router.push(`/admin/${item.navPath}`)
    },
    async onPwdDialogClose(action) {
      if (action !== 'confirm') {
        this.form = { oldPwd: '', newPwd: '' }
        return true
      }
      try {
        await this.$refs.passwordForm.validate()
      } catch (e) {
        return false
      }
      const adminInfo = this.$store.state.adminInfo
      if (!adminInfo || !adminInfo.id) {
        this.$message.warning('当前未登录管理账号')
        return false
      }
      try {
        const res = await editPassword(adminInfo.id, this.form.oldPwd, this.form.newPwd)
        if (res.code !== 0) {
          this.$message.error(res.msg || '修改失败')
          return false
        }
        this.form = { oldPwd: '', newPwd: '' }
        this.$message.success('修改密码成功')
        return true
      } catch (e) {
        this.$message.error('修改失败')
        return false
      }
    },
    handleLogout() {
      this.$confirm('确定退出登录？', '提示', { type: 'warning' })
        .then(() => {
          this.$store.dispatch('websocket/AccountLogoutNotice').catch(() => {})
          this.$store.commit('SET_ADMIN_INO', null)
          this.$store.commit('SET_HTTP_TOKEN', '')
          this.$store.commit('SET_WEBSOCKET_TOKEN', '')
          localStorage.removeItem('httpToken')
          sessionStorage.removeItem('sessionNameOfJuboChat')
          sessionStorage.removeItem('sessionPwdOfJuboChat')
          this.$router.replace('/login')
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-admin {
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.admin-top {
  background: linear-gradient(130deg, #075e54 0%, #0f766e 54%, #65a30d 100%);
  color: #fff;
  flex-shrink: 0;
  padding: calc(12px + env(safe-area-inset-top)) 16px 16px;
}

.admin-user-row {
  align-items: center;
  display: flex;
  gap: 12px;
}

.admin-user-info {
  flex: 1;
  min-width: 0;
}

.admin-user-name {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-user-role {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0.82;
}

:deep(.app-mode-switch) {
  flex-shrink: 0;
  margin: 0;

  .mode-tab {
    padding: 5px 9px;
  }
}

.admin-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 0 calc(24px + env(safe-area-inset-bottom));
  -webkit-overflow-scrolling: touch;
}

.menu-section {
  margin-bottom: 12px;
}

.menu-item-title {
  align-items: center;
  display: inline-flex;
  gap: 8px;
}

.menu-icon {
  color: #07c160;
  font-size: 16px;
  width: 18px;
}

:deep(.menu-item.danger) {
  .van-cell__title {
    color: #ee0a24;
    text-align: center;
    width: 100%;
  }

  .van-cell__value,
  .van-cell__right-icon {
    display: none;
  }
}

.password-form {
  padding: 8px 0 4px;
}

.account-section {
  margin-top: 8px;
}
</style>
