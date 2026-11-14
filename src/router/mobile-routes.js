const mobileFeature = () => import(/* webpackChunkName: "mobile-feature" */ '@/views/mobile/views/feature.vue')

function clientFeature(path, name, title) {
  return {
    path,
    name,
    component: mobileFeature,
    meta: { requireAuth: true, featureKey: name, title }
  }
}

function adminFeature(key, title) {
  return {
    path: `/admin/${key}`,
    name: `admin-${key}`,
    component: mobileFeature,
    meta: { requireAuth: true, featureKey: key, title, adminFeature: true }
  }
}

const routes = [
  { path: '/', redirect: { path: '/conversation' } },
  {
    path: '/login',
    name: 'login',
    component: () => import(/* webpackChunkName: "mobile-login" */ '@/views/mobile/views/login.vue')
  },
  {
    path: '/conversation',
    name: 'conversation',
    component: () => import(/* webpackChunkName: "mobile-index" */ '@/views/mobile/views/index.vue'),
    meta: { requireAuth: true }
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import(/* webpackChunkName: "mobile-chat" */ '@/views/mobile/views/chat.vue'),
    meta: { requireAuth: true }
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import(/* webpackChunkName: "mobile-admin" */ '@/views/mobile/views/admin.vue'),
    meta: { requireAuth: true }
  },
  {
    path: '/manager',
    name: 'manager',
    component: () => import(/* webpackChunkName: "mobile-manager" */ '@/views/mobile/views/manager.vue'),
    meta: { requireAuth: true }
  },
  {
    path: '/chat-room-members',
    name: 'chatRoomMembers',
    component: () => import(/* webpackChunkName: "mobile-chatroom-members" */ '@/views/mobile/views/ChatRoomMembers.vue'),
    meta: { requireAuth: true }
  },
  clientFeature('/friend-circle', 'friendCircle', '朋友圈'),
  clientFeature('/group-assistant', 'groupAssistant', '群发助手'),
  clientFeature('/add-friend', 'addFriend', '加好友'),
  clientFeature('/tools', 'tools', '功能大全'),
  adminFeature('accountManagement', '账号管理'),
  adminFeature('phonesManagement', '手机设备状态'),
  adminFeature('customerManagement', '客户账号列表'),
  adminFeature('phonesManagementSuper', '手机设备状态'),
  adminFeature('regCodeManagement', '注册码管理'),
  adminFeature('commonReplies', '部门公共术语'),
  adminFeature('commonTags', '部门公共标签'),
  adminFeature('friendList', '好友查看'),
  adminFeature('chatRoomList', '群列表'),
  adminFeature('newFriendAutoReply', '新增好友回复'),
  adminFeature('scheduledMassMessage', '定时发消息'),
  adminFeature('scheduledMoments', '定时发圈'),
  adminFeature('materialLibrary', '素材资源库')
]

export default routes
