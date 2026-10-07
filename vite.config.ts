import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_AT__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(process.env.SOURCE_COMMIT || 'unknown'),
  },
  server: { proxy: { '/api': 'http://127.0.0.1:3010' } },
})
