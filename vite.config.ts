import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: './',
  // 只在构建时替换 navigator.connection：dev 下 Vite 客户端用「赋值到全局对象」实现 define，
  // 而 navigator.connection 是只读访问器，赋值会抛 TypeError 并让整个应用白屏
  define: command === 'build' ? { 'navigator.connection': 'undefined' } : {},
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
}))
