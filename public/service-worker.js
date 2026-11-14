/**
 * PWA 停用 —— 自注销型 Service Worker（静态文件）
 * <p>
 * 本文件随构建产物部署到站点根目录，<b>取代</b>历史上 Workbox 生成的 service-worker.js。
 * <p>
 * 背景：项目曾启用 PWA（Workbox 4.x 预缓存），叠加 filenameHashing:false，导致发布后
 * 旧 Service Worker 拦截请求、返回错配的旧 bundle，触发白屏。现已彻底关闭 PWA。
 * <p>
 * 作用：线上存量浏览器里仍注册着指向 /service-worker.js 的旧 SW。浏览器会周期性重新
 * 拉取本文件做字节级比对；一旦发现内容变化（旧的是 Workbox 生成，与此自注销版不同），
 * 就会安装这个新 SW。新 SW 在 activate 阶段：
 * <ul>
 *   <li>清空全部 Cache Storage（移除 Workbox 预缓存）</li>
 *   <li>注销自身，使该域名下不再有受控 SW 拦截请求</li>
 *   <li>对所有受控客户端执行 navigate 强制跳转刷新</li>
 * </ul>
 * 之后该域名彻底回归纯网络加载。
 * <p>
 * <b>保留周期：</b>等线上无浏览器再请求本文件（即存量 SW 全部注销）后，可连同
 * src/registerServiceWorker.js 一起删除。
 */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  // 跳过等待，尽快进入 activate，缩短旧 SW 接管窗口
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. 清空所有 Cache Storage（含历史 Workbox 预缓存）
      if ('caches' in self) {
        try {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        } catch (e) {
          /* ignore */
        }
      }
      // 2. 注销自身注册，使该作用域不再受 SW 控制
      try {
        await self.registration.unregister()
      } catch (e) {
        /* ignore */
      }
      // 3. 通知所有受控窗口刷新，拿到无 SW 控制的最新页面
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        clients.forEach((client) => {
          // navigate 会让客户端重新加载，此时 SW 已注销，将走纯网络
          if (client && typeof client.navigate === 'function') {
            client.navigate(client.url)
          }
        })
      } catch (e) {
        /* ignore */
      }
      return self.clients.claim()
    })()
  )
})

// fetch 不做任何拦截：SW 注销前的残留请求也直接放行到网络
self.addEventListener('fetch', () => {})
