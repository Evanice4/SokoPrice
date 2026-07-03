import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/predict'    : 'http://localhost:8000',
      '/recommend'  : 'http://localhost:8000',
      '/basket'     : 'http://localhost:8000',
      '/alerts'     : 'http://localhost:8000',
      '/commodities': 'http://localhost:8000',
      '/markets'    : 'http://localhost:8000',
    }
  }
})
