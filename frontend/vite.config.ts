import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const certPath = env.VITE_HTTPS_CERT || env.HTTPS_CERT
  const keyPath = env.VITE_HTTPS_KEY || env.HTTPS_KEY

  const hasCert = Boolean(certPath && fs.existsSync(path.resolve(certPath)))
  const hasKey = Boolean(keyPath && fs.existsSync(path.resolve(keyPath)))

  const httpsConfig =
    hasCert && hasKey
      ? {
          cert: fs.readFileSync(path.resolve(certPath!)),
          key: fs.readFileSync(path.resolve(keyPath!)),
        }
      : undefined

  return {
    plugins: [react()],
    server: {
      host: true, // Listen on 0.0.0.0 for LAN access
      port: 5173,
      https: httpsConfig,
    },
  }
})
