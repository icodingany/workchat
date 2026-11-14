import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

const { buildViteEnvDefines, loadViteEnvForMode } = require('./scripts/vite-env-defines.cjs')
const env = loadViteEnvForMode('test', __dirname)
const envDefines = buildViteEnvDefines(env)
const stylesPath = resolve(__dirname, 'src/styles').replace(/\\/g, '/')

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
    ...envDefines
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
  plugins: [vue()],
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'color-functions', 'legacy-js-api'],
        additionalData: '@use "' + stylesPath + '/mixin.scss" as *; @use "' + stylesPath + '/_var.scss" as *;'
      }
    }
  },
  test: {
    environment: 'jsdom',
    // 旧用例是 mocha 风格（describe/it 作为全局），需开启 globals 才能识别
    globals: true,
    include: ['tests/unit/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/utils/chatMessageFields.js',
        'src/utils/chatMerge.js',
        'src/utils/conversationDigest.js',
        'src/utils/conversationSort.js',
        'src/utils/localSendPreview.js',
        'src/utils/openSessionHistory.js',
        'src/utils/openSessionMatch.js',
        'src/utils/wechat.js',
        'src/utils/wsSessionOwner.js',
        'src/utils/msgFieldDebug.js',
        'src/utils/downloadFileDetail.js',
        'src/utils/httpTokenClaims.js',
        'src/utils/chatSenderAccount.js',
        'src/utils/picturePreview.js',
        'src/utils/forwardHelpers.js',
        'src/utils/mapHistoryRowToTalk.js',
        'src/utils/fetchTokenRouting.js'
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75
      }
    }
  }
})
