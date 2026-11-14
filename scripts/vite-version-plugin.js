/**
 * Vite 插件：生成 version.json 文件（对应 webpack 构建中的 VersionJsonPlugin 功能）
 *
 * workchat 的 generate-changelog.js 不导出 main()，且已在 npm run build 前由
 * scripts 流程执行过，这里只读 CHANGELOG.md，不重复生成。
 */

const fs = require('fs')
const path = require('path')

/**
 * 解析 CHANGELOG.md 文件（按日期分组 + 模块分类）
 */
function parseChangelog(content, maxEntries = 10) {
  const entries = []
  const dateRegex = /^## (\d{4}-\d{2}-\d{2})/
  const categoryRegex = /^### (.+)/
  const itemRegex = /^- (.+)/

  let currentEntry = null
  let currentCategory = null

  const lines = content.split('\n')
  for (const line of lines) {
    const dateMatch = line.match(dateRegex)
    if (dateMatch) {
      if (currentEntry) {
        entries.push(currentEntry)
        if (entries.length >= maxEntries) break
      }
      currentEntry = { date: dateMatch[1], categories: [] }
      currentCategory = null
      continue
    }

    const categoryMatch = line.match(categoryRegex)
    if (categoryMatch && currentEntry) {
      currentCategory = { name: categoryMatch[1].trim(), items: [] }
      currentEntry.categories.push(currentCategory)
      continue
    }

    const itemMatch = line.match(itemRegex)
    if (itemMatch && currentEntry) {
      if (currentCategory) {
        currentCategory.items.push(itemMatch[1])
      } else {
        currentCategory = { name: '其他', items: [itemMatch[1]] }
        currentEntry.categories.push(currentCategory)
      }
    }
  }

  if (currentEntry && entries.length < maxEntries) {
    entries.push(currentEntry)
  }

  return entries
}

// 格式化日期为 YYYYMMDDHHmm 格式（用于版本号）
function formatVersionDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}`
}

// 格式化日期为 YYYY-MM-DD HH:mm:ss 格式（用于构建时间）
function formatBuildTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Vite 插件：生成 version.json 文件
 */
function viteVersionPlugin() {
  return {
    name: 'vite-version-plugin',
    apply: 'build',

    buildStart() {
      const buildDate = new Date()

      let changelog = []
      try {
        const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md')
        if (fs.existsSync(changelogPath)) {
          const content = fs.readFileSync(changelogPath, 'utf-8')
          changelog = parseChangelog(content, 10)
          console.log('vite-version-plugin: 成功解析 CHANGELOG.md，共 ' + changelog.length + ' 个版本')
        } else {
          console.log('vite-version-plugin: 未找到 CHANGELOG.md，跳过更新日志')
        }
      } catch (err) {
        console.warn('vite-version-plugin: 解析 CHANGELOG.md 失败:', err.message)
      }

      const versionData = {
        version: formatVersionDate(buildDate),
        buildTime: formatBuildTime(buildDate),
        description: '企聊客服系统 版本信息',
        clearDataOnUpgrade: process.env.CLEAR_DATA_ON_UPGRADE === 'true',
        changelog: changelog
      }

      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(versionData, null, 2)
      })

      console.log('vite-version-plugin: 生成 version.json 文件')
    }
  }
}

module.exports = viteVersionPlugin
