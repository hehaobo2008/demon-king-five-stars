import { defineConfig } from 'vite'

// base './' 让 dist 产物在任意子路径 / 静态托管下都能直接打开
export default defineConfig({
  base: './',
})