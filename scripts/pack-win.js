/**
 * Windows 安装包打包（workchat，electron-vite 快速路径）
 *
 * 直接 electron-builder 会扫描整个 node_modules（数 GB，极慢 / OOM）。
 * 流程：vite:build → 最小临时目录 → electron-packager → electron-builder --prepackaged
 *
 * workchat 比 kelailaichatpc 简单很多：无 native 依赖（无 sqlite3/sharp）、无 AI SDK、
 * 无截图模块。主进程唯一运行时 npm 依赖是 electron-updater（已 external，需随包带上）。
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { rmSync, mkdirSync, cpSync, writeFileSync } = fs
const { resolveElectronAppVersion } = require('./electron-app-version')

const root = path.join(__dirname, '..')
const electronAppVersion = resolveElectronAppVersion()
// 每次唯一目录，避免上次 npm/杀毒占用 temp_app 导致 EBUSY 整包失败
const runStamp = `${Date.now()}_${process.pid}`
const tempDir = path.join(root, 'dist_electron', `temp_app_${runStamp}`)
const packagerDir = path.join(root, 'dist_electron', `packager_${runStamp}`)
const PACKAGER_APP_NAME = 'workchat'
const packagedApp = path.join(packagerDir, `${PACKAGER_APP_NAME}-win32-x64`)

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts })
}

/** 尽力清理；失败只警告，不阻断（本轮已用唯一目录）。 */
function forceRemoveDir(dir) {
  if (!fs.existsSync(dir)) return
  for (let i = 0; i < 5; i += 1) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch (err) {
      const code = err && err.code
      if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'ENOTEMPTY') throw err
      try {
        const stale = `${dir}_stale_${Date.now()}_${i}`
        fs.renameSync(dir, stale)
        try {
          rmSync(stale, { recursive: true, force: true })
        } catch (_) {}
        return
      } catch (_) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
      }
    }
  }
  console.warn(`警告: 无法清理（仍被占用，可稍后手动删）: ${dir}`)
}

/**
 * 生成临时 projectDir 用的 electron-builder.yml：图标/资源用绝对路径，
 * 产物 outDir 直接写到根 dist_electron（不在 tempDir 下套一层）。
 * 与根 electron-builder.yml 内容一致，仅路径绝对化。
 */
function buildTempBuilderYml(root, _version) {
  const abs = (p) => path.join(root, p).replace(/\\/g, '/')
  const winIcon = abs('public/app.ico')
  return [
    'appId: com.jubochat.workchat.app',
    'productName: 企聊客服系统',
    'executableName: workchat',
    `copyright: Copyright © 2019-2026 kelailai`,
    'electronVersion: 43.1.0',
    'npmRebuild: false',
    `directories:`,
    `  output: ${abs('dist_electron')}`,
    'electronDownload:',
    '  mirror: https://npmmirror.com/mirrors/electron/',
    'asar: true',
    'compression: store',
    'files:',
    '  - out/**',
    '  - electron/main/updaterConfig.js',
    '  - electron/main/updaterInstall.js',
    '  - electron/main/updaterErrors.js',
    'extraResources:',
    `  - from: ${abs('out/renderer/version.json')}`,
    '    to: ../version.json',
    `  - from: ${winIcon}`,
    '    to: ../app.ico',
    `  - from: ${abs('public/empty.ico')}`,
    '    to: ../empty.ico',
    'win:',
    `  icon: ${winIcon}`,
    '  artifactName: workchat-Setup-${version}.${ext}',
    '  target:',
    '    - target: nsis',
    '      arch:',
    '        - x64',
    'nsis:',
    '  oneClick: false',
    '  allowElevation: true',
    '  allowToChangeInstallationDirectory: true',
    `  installerIcon: ${winIcon}`,
    `  uninstallerIcon: ${winIcon}`,
    `  installerHeaderIcon: ${winIcon}`,
    '  createDesktopShortcut: true',
    '  createStartMenuShortcut: true',
    '  shortcutName: 企聊客服系统',
    '  uninstallDisplayName: 企聊客服系统',
    '  deleteAppDataOnUninstall: false',
    '  runAfterFinish: true',
    '  warningsAsErrors: false',
    '  packElevateHelper: true',
    'publish:',
    '  - provider: generic',
    '    url: https://file.example.invalid/workchat/',
    ''
  ].join('\n')
}

console.log('开始打包 Windows 客户端...\n')
console.log(`版本号: ${electronAppVersion}\n`)

// 0. 编译 electron-vite（可 SKIP_VITE_BUILD=1 跳过）
if (process.env.SKIP_VITE_BUILD !== '1') {
  console.log('0. electron-vite build...')
  run('npm run vite:build', {
    env: { ...process.env, ELECTRON_APP_VERSION: electronAppVersion }
  })
}

if (!fs.existsSync(path.join(root, 'out/main/index.js'))) {
  console.error('缺少 out/main/index.js，请先 npm run vite:build')
  process.exit(1)
}

// 主进程 helper（updaterConfig/updaterInstall/updaterErrors）被 out/main/index.js 相对 require，
// electron-vite 只 bundle 了 index.js，须手动把 helper 同步拷到 out/main/
const mainHelperFiles = ['updaterErrors.js', 'updaterConfig.js', 'updaterInstall.js']
for (const name of mainHelperFiles) {
  const src = path.join(root, 'electron/main', name)
  if (!fs.existsSync(src)) continue
  cpSync(src, path.join(root, 'out/main', name))
  console.log(`   ✓ out/main/${name}`)
}
// 硬校验：主进程 require('./updaterConfig') 等会崩，缺文件直接中止
for (const name of mainHelperFiles) {
  const dest = path.join(root, 'out/main', name)
  if (!fs.existsSync(dest)) {
    console.error(`缺少 out/main/${name}，打包中止（主进程 require('./${name.replace(/\.js$/, '')}') 会崩溃）`)
    process.exit(1)
  }
}

// 硬校验：Electron 包 currentMode 必须是 electron，否则顶栏三按钮整段 v-if 消失
// （electron.vite.config 强制注入 process.env.VUE_APP_CURRENTMODE='electron'，
//  define 后比较被常量折叠为 true，这里校验 store.currentMode 默认值未被错误覆盖）
{
  const assetsDir = path.join(root, 'out/renderer/assets')
  if (fs.existsSync(assetsDir)) {
    const bad = fs
      .readdirSync(assetsDir)
      .filter((f) => f.endsWith('.js'))
      .find((f) => {
        const s = fs.readFileSync(path.join(assetsDir, f), 'utf8')
        return /currentMode:\s*"web"/.test(s)
      })
    if (bad) {
      console.error(
        `检测到 ${bad} 中 currentMode:"web"，Electron 包必须是 electron。请检查 electron.vite.config.ts 的 VUE_APP_CURRENTMODE 强制注入。`
      )
      process.exit(1)
    }
    console.log('   ✓ renderer currentMode is not web')
  }
}

// 1. 临时目录
console.log('\n1. 准备临时目录...')
console.log(`   tempDir=${tempDir}`)
mkdirSync(tempDir, { recursive: true })
forceRemoveDir(path.join(root, 'dist_electron', 'temp_app'))
forceRemoveDir(path.join(root, 'dist_electron', 'packager'))

// 2. 复制 electron-vite 产物 + 写最小化 package.json
console.log('2. 复制 electron-vite 产物...')
cpSync(path.join(root, 'out'), path.join(tempDir, 'out'), { recursive: true })
console.log('   ✓ out/')

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
// workchat 主进程运行时 npm 依赖：只有 electron-updater（external require，未打进 out/main bundle）
const minimalDeps = {}
if (pkg.dependencies && pkg.dependencies['electron-updater']) {
  minimalDeps['electron-updater'] = pkg.dependencies['electron-updater']
}
const minimalPkg = {
  name: pkg.name,
  version: electronAppVersion,
  private: true,
  main: 'out/main/index.js',
  productName: pkg.productName || '企聊客服系统',
  author: pkg.author,
  dependencies: minimalDeps
}
writeFileSync(path.join(tempDir, 'package.json'), `${JSON.stringify(minimalPkg, null, 2)}\n`)
console.log(`   ✓ package.json (minimal, ${Object.keys(minimalDeps).length} runtime deps)`)

// 2b. 从项目根 node_modules 复制运行时依赖树（跳过 temp 内 npm install：
// Windows 上 npm 常挂死）
if (Object.keys(minimalDeps).length > 0) {
  console.log(`\n2b. 复制运行时依赖（${Object.keys(minimalDeps).length} 个入口 + 传递依赖）...`)
  const nmRoot = path.join(root, 'node_modules')
  const nmDest = path.join(tempDir, 'node_modules')
  mkdirSync(nmDest, { recursive: true })

  function readPkgDeps(pkgName) {
    const pkgJson = path.join(nmRoot, pkgName, 'package.json')
    if (!fs.existsSync(pkgJson)) return []
    try {
      const p = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
      return Object.keys(p.dependencies || {})
    } catch (_) {
      return []
    }
  }

  const needed = new Set()
  const queue = Object.keys(minimalDeps)
  while (queue.length) {
    const name = queue.shift()
    if (!name || needed.has(name)) continue
    needed.add(name)
    for (const dep of readPkgDeps(name)) {
      if (!needed.has(dep)) queue.push(dep)
    }
  }

  let copied = 0
  let missing = 0
  for (const name of needed) {
    const src = path.join(nmRoot, name)
    if (!fs.existsSync(src)) {
      console.warn(`   ⚠ 缺失: node_modules/${name}`)
      missing += 1
      continue
    }
    const dest = path.join(nmDest, name)
    mkdirSync(path.dirname(dest), { recursive: true })
    cpSync(src, dest, { recursive: true })
    copied += 1
  }
  console.log(`   ✓ 已复制 ${copied} 个包${missing ? `（缺失 ${missing}）` : ''}`)
  if (copied === 0) {
    throw new Error('未能从项目 node_modules 复制任何运行时依赖，请先在项目根执行 npm install')
  }
}

// 3. electron-packager（不扫描项目 node_modules）
console.log('\n3. electron-packager...')
const iconPath = path.join(root, 'public/app.ico')
const iconArg = fs.existsSync(iconPath) ? ` --icon="${iconPath}"` : ''
const electronVersion = (() => {
  try {
    const eb = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
    const m = eb.match(/^electronVersion:\s*([^\s#]+)/m)
    if (m) return m[1].trim()
  } catch (_) {
    /* ignore */
  }
  try {
    return require(path.join(root, 'node_modules/electron/package.json')).version
  } catch (_) {
    return '43.1.0'
  }
})()
console.log(`   electron-packager 使用 Electron ${electronVersion}`)
run(
  `npx electron-packager . ${PACKAGER_APP_NAME} --platform=win32 --arch=x64 --out="${packagerDir}" --overwrite --electron-version=${electronVersion} --no-prune${iconArg}`,
  {
    cwd: tempDir,
    env: {
      ...process.env,
      ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
    }
  }
)

if (!fs.existsSync(packagedApp)) {
  console.error('找不到打包产物:', packagedApp)
  process.exit(1)
}

// 4. 写 resources/app-update.yml（--prepackaged 模式 electron-builder 偶发漏写）
console.log('\n4. 写 app-update.yml...')
const { buildAppUpdateYmlContent } = require('../electron/main/updaterConfig')
const feedUrl = (() => {
  try {
    const eb = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
    const m = eb.match(/url:\s*(\S+)/)
    return m ? m[1] : 'https://file.example.invalid/workchat/'
  } catch (_) {
    return 'https://file.example.invalid/workchat/'
  }
})()
const appUpdateYml = path.join(packagedApp, 'resources', 'app-update.yml')
mkdirSync(path.dirname(appUpdateYml), { recursive: true })
writeFileSync(appUpdateYml, buildAppUpdateYmlContent(feedUrl), 'utf8')
console.log(`   ✓ app-update.yml (feed=${feedUrl})`)

// 5. electron-builder --prepackaged（生成 NSIS 安装包）
// 关键：以临时目录为 projectDir，electron-builder --prepackaged 从其 package.json 读版本号
// （时间戳格式 2026.729.51，符合 workchat 发布方案）。
// 临时目录写一份用绝对路径的 electron-builder.yml，避免图标/资源相对路径找不到。
console.log('\n5. electron-builder --prepackaged...')
writeFileSync(
  path.join(tempDir, 'electron-builder.yml'),
  buildTempBuilderYml(root, electronAppVersion),
  'utf8'
)
run(
  `npx electron-builder --publish never --win --x64 --prepackaged="${packagedApp}" --projectDir="${tempDir}"`,
  {
    cwd: root,
    env: { ...process.env, ELECTRON_APP_VERSION: electronAppVersion }
  }
)

// 6. 校正 latest.yml（electron-updater 读取的版本清单）
console.log('\n6. ensure-electron-update-yml...')
try {
  run('node scripts/ensure-electron-update-yml.js', {
    env: { ...process.env, ELECTRON_APP_VERSION: electronAppVersion }
  })
} catch (e) {
  console.warn('   ⚠ ensure-electron-update-yml 失败（不阻断）:', e && e.message)
}

// 7. 清理临时目录
console.log('\n7. 清理临时目录...')
forceRemoveDir(tempDir)

console.log('\n✅ 打包完成')
console.log(`   产物目录: ${path.join(root, 'dist_electron')}`)
