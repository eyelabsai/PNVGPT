import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ask': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ask/stream': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/lead': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/log-event': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
