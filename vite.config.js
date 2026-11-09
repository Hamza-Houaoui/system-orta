import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5174,
    proxy: {
      '/tg-file': {
        target: 'https://api.telegram.org/file',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tg-file/, '')
      }
    }
  },
})
