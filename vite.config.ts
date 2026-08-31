import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  define: {
    'navigator.connection': 'undefined',
  },
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        strict: true,
      },
    },
  },
  plugins: [react()],
  publicDir: false,
})
