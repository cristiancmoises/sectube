import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // In dev, we proxy /api to RapidAPI directly so you don't need nginx running.
  // In prod, nginx handles /api — this config is irrelevant there.
  const rapidApiKey = env.VITE_DEV_RAPIDAPI_KEY || '';
  const rapidApiHost = env.VITE_DEV_RAPIDAPI_HOST || 'youtube-v31.p.rapidapi.com';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: false,
      proxy: {
        '/api': {
          target: `https://${rapidApiHost}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (rapidApiKey) proxyReq.setHeader('X-RapidAPI-Key', rapidApiKey);
              proxyReq.setHeader('X-RapidAPI-Host', rapidApiHost);
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // Don't inline any asset — we want long-cache hashed filenames.
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // Function form for vite 8 / rolldown compatibility.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-router') || id.includes('/react-dom/') || id.match(/\/react\//)) {
              return 'react';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui';
            }
            return undefined;
          },
        },
      },
    },
  };
});
