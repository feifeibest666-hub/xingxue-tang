import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/xingxue-tang/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
})
