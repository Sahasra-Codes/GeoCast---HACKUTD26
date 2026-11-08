import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
export default defineConfig(({ mode }) => {
  const frontend = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')
  const backend = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), 'SUPABASE_')
  const url = frontend.VITE_SUPABASE_URL || backend.SUPABASE_PROJECT_URL || ''
  const key = frontend.VITE_SUPABASE_PUBLISHABLE_KEY || backend.SUPABASE_PUBLISHABLE_KEY || ''
  if (key.startsWith('sb_secret_')) throw new Error('Use a Supabase publishable key, never a secret key, in the frontend.')
  return { plugins: [react(), tailwindcss()], define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key) }, server: { proxy: { '/api/relief': 'http://127.0.0.1:8001', '/api/priority': 'http://127.0.0.1:8001', '/api/advance': 'http://127.0.0.1:8001', '/api/briefing': 'http://127.0.0.1:8001', '/api/dispatch': 'http://127.0.0.1:8001', '/api': 'http://127.0.0.1:8000' } } }
})
