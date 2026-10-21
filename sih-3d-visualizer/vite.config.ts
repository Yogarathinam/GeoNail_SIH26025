import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { brevoApiPlugin } from './server/brevoPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), brevoApiPlugin()],
})
