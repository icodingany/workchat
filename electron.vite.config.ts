import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

const { buildViteEnvDefines, loadViteEnvForMode } = require('./scripts/vite-env-defines.cjs')
const viteVersionPlugin =
  require('./scripts/vite-version-plugin.js').default || require('./scripts/vite-version-plugin.js')

const stylesPath = resolve(__dirname, 'src/styles').replace(/\\/g, '/')

/**
 * 把 .env.*.electron 的 VUE_APP_* 通过 define 注入为 process.env.*。
 * 关键：强制覆盖 process.env.VUE_APP_CURRENTMODE = 'electron'，
 * 否则根 .env 的 'web' 会顶栏三按钮整段 v-if 消失。
 */
function buildElectronEnvDefines(mode) {
  const env = loadViteEnvForMode(mode, __dirname)
  // 强制 electron 模式（覆盖任何 .env 里的 web）
  env.VUE_APP_CURRENTMODE = 'electron'
  const defines = buildViteEnvDefines(env)
  defines['process.env.VUE_APP_CURRENTMODE'] = JSON.stringify('electron')
  return defines
}

export default defineConfig({
  main: {
    build: {
      lib: { entry: 'electron/main/index.js' },
      rolldownOptions: {
        // 主进程依赖在运行时从 node_modules require，不打进 bundle（除 electron-updater 需要内联）
        external: ['electron', 'electron-updater']
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }
  },
  preload: {
    build: {
      lib: { entry: 'electron/preload/index.js' },
      rolldownOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    base: './',
    publicDir: resolve(__dirname, 'public'),
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV === 'development' ? 'development' : 'production'
      ),
      'process.env.BASE_URL': JSON.stringify('./'),
      ...buildElectronEnvDefines('production.electron')
    },
    resolve: {
      alias: [
        { find: /^~@/, replacement: resolve(__dirname, 'src') },
        { find: '@', replacement: resolve(__dirname, 'src') },
        { find: 'assets', replacement: resolve(__dirname, 'src/assets') },
        { find: 'components', replacement: resolve(__dirname, 'src/components') }
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
      dedupe: ['vue']
    },
    plugins: [vue(), viteVersionPlugin()],
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['import', 'color-functions', 'legacy-js-api'],
          additionalData:
            '@use "' + stylesPath + '/mixin.scss" as *; @use "' + stylesPath + '/_var.scss" as *;'
        }
      }
    },
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      emptyOutDir: true,
      modulePreload: false,
      minify: process.env.NODE_ENV === 'development' ? false : 'oxc',
      rolldownOptions: {
        input: resolve(__dirname, 'src/index.html')
      }
    },
    server: {
      port: 8090
    }
  }
})
