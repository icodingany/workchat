# 集成与运行范围

## 本地开发

使用 Node.js 22.12+（推荐 24 LTS），执行：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

`npm run build` 输出 `dist_workchat/`，随后可用 `npm run preview` 检查构建。公开仓库不包含依赖目录或构建产物。

## 配套服务

1. 主账号服务校验账号密码，返回 access token。
2. wework-server 的 `/user/sso/login` 将主账号 token 兑换为本系统登录态。
3. WebSocket 发送认证请求，随后接收账号、联系人、会话及任务通知。
4. 消息、任务和设备操作需要对应的设备端在线；文件上传按配置连接文件服务。

本仓库没有内置后端或默认管理员数据。公开体验账号是在线测试站提供的账号，不会在本地自动生成。

## 环境文件

`scripts/vite-env-defines.cjs` 将 `VUE_APP_*` 配置桥接到 Vite。请直接修改对应 mode 的环境文件，修改后重新启动或构建；该实现不自动合并 `.env.local`。

公开版本的 API 和 WebSocket 默认指向本机。更新服务、示例文件域名及 iframe 宿主域名使用 `example.invalid`，启用对应功能前需替换成自己的配置。

如需 iframe SSO，按自己的宿主来源修改 `src/utils/wecomEmbedBridge.js` 中的精确 origin 白名单。后端跨域策略需与前端来源及带凭据请求方式一致。

## 本地数据库

`src/db/dexie/database.js` 定义 WorkchatDB：版本 1 的 11 张表，加版本 2 的 chats 表，共 12 张。浏览器自动创建数据库，不需要导入 MySQL SQL。

公开版本不携带 IndexedDB 导出、客户聊天记录、联系人、cookie 或登录态。单元测试中的账号、姓名和业务编号是用于回归验证的合成值。

## 桌面能力

- Electron 使用隔离的 main / preload / renderer 三入口，原生能力经 IPC 桥接。
- `npm run vite:build` 只编译桌面源码；启动窗口与生成安装包还需要 Electron 运行时及平台构建工具。
- Windows 打包命令包含 `--publish never`，不会将安装包推送到原线上服务。
- 自动更新源为示例域名，启用前应同时对齐 builder 配置、打包脚本和 updaterConfig。
- 原截图插件未随开源仓库分发。可使用系统截图并粘贴；如自行接入插件，请确保授权和分发路径正确。
- Tauri 目前有基础窗口和打开外部链接能力，截图、消息通知及更新相关接口存在占位实现。
- Capacitor 配置保留，但未附 Android/iOS 原生项目或安装包验收结果。

## 验证边界

单元测试、Web/Electron 构建及本地登录页浏览器检查，不代表完成真实登录、消息收发、上传、设备操作或桌面安装包端到端验收。这些应在自己的配套环境中验证。
