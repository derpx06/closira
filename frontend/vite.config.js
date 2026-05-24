import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Dev proxy target must match backend `PORT` (backend/.env).
 * Override with VITE_DEV_PROXY_TARGET in frontend/.env (e.g. http://127.0.0.1:5001).
 */
function resolveDevApiProxyTarget(mode, envDir) {
  const fileEnv = loadEnv(mode, envDir, '')
  const explicit =
    fileEnv.VITE_DEV_PROXY_TARGET ||
    process.env.VITE_DEV_PROXY_TARGET
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim().replace(/\/+$/, '')
  }

  const backendEnvPath = resolve(__dirname, '../backend-fastapi/.env')
  try {
    if (existsSync(backendEnvPath)) {
      const raw = readFileSync(backendEnvPath, 'utf8')
      const line = raw.split(/\r?\n/).find((l) => /^\s*PORT=\d+\s*$/.test(l))
      if (line) {
        const port = line.split('=')[1]?.trim()
        if (port) return `http://127.0.0.1:${port}`
      }
    }
  } catch {
    /* ignore */
  }
  return 'http://127.0.0.1:5001'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const apiProxyTarget = resolveDevApiProxyTarget(mode, __dirname)
  if (mode === 'development') {
    console.info(`[vite] dev server will proxy /api → ${apiProxyTarget}`)
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
