import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ChatbotPackage',
      formats: ['es', 'umd'],
      fileName: 'chatbot-package',
    },
  },
})
