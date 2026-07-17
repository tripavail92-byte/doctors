import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the Health OS web frontend.
// The dev server proxies /api to the NestJS backend. The backend mounts its
// routes at the root (no /api prefix), so we strip the prefix on the way
// through — the axios client uses baseURL '/api' to keep app code clean and
// avoid CORS during local development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
