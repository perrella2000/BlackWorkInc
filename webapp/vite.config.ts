import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  server: {
    port: 1574,
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
