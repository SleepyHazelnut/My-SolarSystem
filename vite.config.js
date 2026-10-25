import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      // 这三处都不属于前端源码：记忆文件、草稿区、原始设计稿
      ignored: ['**/.workbuddy-ai/**', '**/_draft/**', '**/星球素材/**'],
    },
  },

  build: {
    // 调高避免噪音
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // 两个入口：index.html 是黑洞主页（单文件、内联 GSAP，无模块依赖），
      // viewer.html 是星系角色浏览页（走 src/main.js）。漏一个，产物里就少一页。
      input: {
        main: here('index.html'),
        viewer: here('viewer.html'),
      },
    },
  },
});
