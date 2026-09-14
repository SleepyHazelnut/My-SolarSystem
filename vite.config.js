import { defineConfig } from 'vite';

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
  },
});
