import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Local operator hub UI.
// Optional bridge server defaults to http://localhost:8787
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
