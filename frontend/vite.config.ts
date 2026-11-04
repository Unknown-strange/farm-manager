import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function isLikelyBackendUrl(key: string, val: string | undefined): boolean {
  if (!val) return false
  const trimmed = val.trim()
  if (!trimmed || trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) return false
  const upperKey = key.toUpperCase()
  // Ignore Vercel/Git/Node system variables
  if (
    upperKey.startsWith('VERCEL') ||
    upperKey.startsWith('GIT') ||
    upperKey.startsWith('NPM_') ||
    upperKey.startsWith('NODE_') ||
    upperKey === 'REPOSITORY_URL'
  ) {
    return false
  }
  const matchesKey =
    upperKey.startsWith('VITE_') ||
    upperKey.includes('API') ||
    upperKey.includes('BACKEND') ||
    upperKey.includes('SERVER') ||
    upperKey.includes('RENDER')
  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /\.(onrender\.com|railway\.app|fly\.dev|koyeb\.app|herokuapp\.com)(\/|$)/i.test(trimmed)
  return matchesKey && looksLikeUrl
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mergedEnv: Record<string, string | undefined> = { ...env, ...process.env }

  const priorityCandidates = [
    mergedEnv.VITE_API_URL,
    mergedEnv.VITE_BACKEND_URL,
    mergedEnv.VITE_API_BASE_URL,
    mergedEnv.VITE_API,
    mergedEnv.VITE_SERVER_URL,
    mergedEnv.BACKEND_URL,
    mergedEnv.API_URL,
    mergedEnv.API_BASE_URL,
    mergedEnv.SERVER_URL,
  ]

  let resolvedBuildApiUrl =
    priorityCandidates
      .map((v) => v?.trim())
      .find((v) => v && v !== 'http://localhost:8000' && v !== 'http://127.0.0.1:8000') || ''

  if (!resolvedBuildApiUrl) {
    for (const [k, v] of Object.entries(mergedEnv)) {
      if (isLikelyBackendUrl(k, v)) {
        resolvedBuildApiUrl = v!.trim()
        break
      }
    }
  }

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
