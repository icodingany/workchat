import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { visualizer } from 'rollup-plugin-visualizer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
// CJS 脚本通过 createRequire 加载避免 ESM 报错
const viteVersionPlugin =
  require('./scripts/vite-version-plugin.js').default || require('./scripts/vite-version-plugin.js')

export default defineConfig(({ mode }) => {
  const { buildViteEnvDefines, createVueAppEnvDevPlugin, loadViteEnvForMode } = require(
    './scripts/vite-env-defines.cjs'
  )

  // 按 mode 选择 env 文件；production 的 .env 在发布干净目录中可能不存在，需保留生产默认值。
  const env = loadViteEnvForMode(mode, __dirname)
  const envDefines = buildViteEnvDefines(env)

  const stylesPath = resolve(__dirname, 'src/styles').replace(/\\/g, '/')
  const isAnalyze = process.env.ANALYZE === '1'

  return {
    base: '/',
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        mode === 'development' ||
          mode === 'development.electron' ||
          mode === 'development.tauri'
          ? 'development'
          : 'production'
      ),
      'process.env.BASE_URL': JSON.stringify('/'),
      'process.env.VERSION': JSON.stringify(formatVersionDate(new Date())),
      'process.env.BUILD_TIME': JSON.stringify(Date.now()),
      ...envDefines
    },
    // Vite 入口：src/index.html（与 electron-vite renderer 统一，root=src）
    // publicDir 指向 public/（图标、favicon、electron 用的 ico 等）
    root: resolve(__dirname, 'src'),
    publicDir: resolve(__dirname, 'public'),

    server: {
      host: 'localhost',
      port: 8090,
      open: false,
      watch: {
        ignored: ['**/node_modules/**', '**/dist*/**', '**/out/**']
      }
    },

    build: {
      outDir: resolve(__dirname, 'dist_workchat'),
      emptyOutDir: true,
      // 关闭 modulepreload：首屏同步依赖多，预加载会并发拉 chunk，慢网首屏极慢
      modulePreload: false,
      sourcemap: mode === 'development',
      // Vite 8 默认 Oxc；显式声明，避免回退到已弃用的 esbuild minify
      minify: mode === 'development' ? false : 'oxc',
      // 拆包：用 manualChunks 精确控制（codeSplitting.groups 在本项目的 element-plus/vue 间
      // 产生循环依赖白屏，已弃用）。element-plus + vue runtime 强制同 chunk。
      rolldownOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            if (name.endsWith('.css')) {
              return 'css/[name]-[hash][extname]'
            }
            const ext = name.split('.').pop()
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return 'img/[name][extname]'
            }
            if (/woff2?|eot|ttf|otf/i.test(ext)) {
              return 'fonts/[name][extname]'
            }
            return 'assets/[name][extname]'
          },
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            // element-plus 及其依赖的 vue runtime 必须同 chunk（防 _plugin-vue_export-helper
            // 与 vue 成环 → 初始化时 isFunction 未就绪 → "T/We is not a function" 白屏）
            if (/[\\/]node_modules[\\/](element-plus|@element-plus|@vue|vue|vuex|vue-router)[\\/]/.test(id)) {
              return 'element-plus'
            }
            if (id.includes('node_modules/dexie')) return 'dexie'
            if (id.includes('node_modules/axios')) return 'axios'
            if (id.includes('node_modules/dayjs')) return 'dayjs'
            if (id.includes('node_modules/lodash')) return 'lodash'
            if (id.includes('node_modules/xlsx')) return 'xlsx'
            return undefined
          }
        },
        onwarn(warning, warn) {
          if (
            warning.code === 'MIXED_EXPORTS' ||
            warning.code === 'THIS_IS_UNDEFINED' ||
            warning.code === 'EVAL' ||
            warning.message?.includes('default export')
          ) {
            return
          }
          warn(warning)
        }
      },
      chunkSizeWarningLimit: 1000
    },

    resolve: {
      alias: [
        // 兼容 webpack 风格的 ~@/... 引用（迁移期保留）
        { find: /^~@/, replacement: resolve(__dirname, 'src') },
        { find: '@', replacement: resolve(__dirname, 'src') },
        { find: 'assets', replacement: resolve(__dirname, 'src/assets') },
        { find: 'components', replacement: resolve(__dirname, 'src/components') }
      ],
      // Vue CLI(webpack) 默认 resolve.extensions 含 .vue，且目录会解析到 index.vue/index.js。
      // Vite 默认不含 .vue，也不把目录解析到 index.vue —— 这里补齐，避免全量改 import 路径。
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
      dedupe: ['vue']
    },

    plugins: [
      // Vite 5 serve 不应用 define：开发态内联 VUE_APP_*，避免请求打到 :8090
      createVueAppEnvDevPlugin(env),
      vue(),
      viteVersionPlugin(),
      ...(isAnalyze
        ? [
            visualizer({
              filename: 'dist_workchat/stats.html',
              gzipSize: true,
              brotliSize: true
            })
          ]
        : [])
    ],

    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['import', 'color-functions', 'legacy-js-api'],
          additionalData:
            '@use "' + stylesPath + '/mixin.scss" as *; @use "' + stylesPath + '/_var.scss" as *;'
        }
      }
    },

    optimizeDeps: {
      include: ['vue', 'vuex', 'vue-router', 'axios', 'element-plus', 'element-plus/es', 'dexie', 'mitt'],
      rolldownOptions: {
        output: {
          keepNames: true
        }
      }
    },

    target: 'es2020'
  }
})

function formatVersionDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}`
}
