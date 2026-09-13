import { defineConfig } from 'vite';

export default defineConfig({
  // .riv 是自定义扩展名，显式声明成静态资源
  assetsInclude: ['**/*.riv'],

  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      // Rive 工程里这些和前端无关
      ignored: [
        '**/rive/assets/**',
        '**/rive/星球素材/**',
        '**/.workbuddy-ai/**',
      ],
    },
  },

  build: {
    // 调高避免噪音
    chunkSizeWarningLimit: 4000,
  },
});
