import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const candidateUrls = [
    process.env.VITE_API_URL,
    process.env.VITE_BACKEND_URL,
    process.env.VITE_API_BASE_URL,
    process.env.BACKEND_URL,
    process.env.API_URL,
    process.env.API_BASE_URL,
    env.VITE_API_URL,
    env.VITE_BACKEND_URL,
    env.VITE_API_BASE_URL,
    env.BACKEND_URL,
    env.API_URL,
    env.API_BASE_URL,
  ]
  const resolvedBuildApiUrl =
    candidateUrls
      .map((v) => v?.trim())
      .find((v) => v && v !== 'http://localhost:8000' && v !== 'http://127.0.0.1:8000') || ''

  return {
    plugins: [react()],
    define: {
      __BUILD_API_URL__: JSON.stringify(resolvedBuildApiUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
