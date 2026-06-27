import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // In dev we proxy /api straight to Google's YouTube Data API so you don't need
  // nginx/OpenResty running. Production uses the OpenResty rotator instead, which
  // rotates across many keys — dev just uses the first key you provide.
  const apiHost = env.VITE_DEV_GOOGLE_API_HOST || 'youtube.googleapis.com';
  const devKey = (env.VITE_DEV_GOOGLE_API_KEYS || env.VITE_DEV_GOOGLE_API_KEY || '')
    .split(/[,\s]+/)
    .filter(Boolean)[0] || '';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: false,
      proxy: {
        '/api': {
          target: `https://${apiHost}`,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => {
            const p = path.replace(/^\/api/, '/youtube/v3');
            if (!devKey) return p;
            return p + (p.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(devKey);
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
            // Description sanitizer — only needed on the (lazy) video page.
            if (id.includes('dompurify')) return 'sanitize';
            if (id.includes('dayjs') || id.includes('axios')) return 'vendor';
            return undefined;
          },
        },
      },
    },
  };
});
