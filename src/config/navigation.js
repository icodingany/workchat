export const clientNavigation = [
  { name: '聚合聊天', path: '/conversation', icon: 'fa fa-h-square fa-lg' },
  { name: '朋友圈', path: '/friend-circle', icon: 'fa fa-chrome fa-lg' },
  { name: '群发', path: '/group-assistant', icon: 'fa fa-paper-plane-o fa-lg' },
  { name: '加好友', path: '/add-friend', icon: 'fa fa-user-plus fa-lg' },
  { name: '功能大全', path: '/tools', icon: 'fa fa-th-large fa-lg' }
]

const companyAdminNavigation = [
  { navName: '账号管理', navIcon: 'el-icon-service', navPath: 'accountManagement' },
  { navName: '手机设备状态', navIcon: 'el-icon-mobile-phone', navPath: 'phonesManagement' },
  { navName: '部门公共术语', navIcon: 'el-icon-chat-line-square', navPath: 'commonReplies' },
  { navName: '部门公共标签', navIcon: 'el-icon-collection-tag', navPath: 'commonTags' },
  {
    navName: '企微号管理',
    navIcon: 'el-icon-chat-dot-round',
    isOpen: true,
    children: [
      { navName: '好友查看', navPath: 'friendList' },
      { navName: '群列表', navPath: 'chatRoomList' },
      { navName: '新增好友回复', navPath: 'newFriendAutoReply' }
    ]
  },
  {
    navName: '辅助营销',
    navIcon: 'el-icon-s-promotion',
    isOpen: false,
    children: [
      { navName: '定时发消息', navPath: 'scheduledMassMessage' },
      { navName: '定时发圈', navPath: 'scheduledMoments' },
      { navName: '素材资源库', navPath: 'materialLibrary' }
    ]
  }
]

const superAdminNavigation = [
  { navName: '客户账号列表', navIcon: 'el-icon-s-custom', navPath: 'customerManagement' },
  { navName: '手机设备状态', navIcon: 'el-icon-mobile-phone', navPath: 'phonesManagementSuper' },
  { navName: '注册码管理', navIcon: 'el-icon-key', navPath: 'regCodeManagement' }
]

export function getAdminNavigation(superAdmin) {
  const navs = superAdmin ? superAdminNavigation : companyAdminNavigation
  return navs.map((nav) => ({
    ...nav,
    children: nav.children ? nav.children.map((child) => ({ ...child })) : undefined
  }))
}

export function flattenNavigation(navs) {
  return navs.flatMap((nav) => (nav.children ? nav.children : [nav]))
}
