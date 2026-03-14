import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7760,
    proxy: {
      '/api': {
        target: 'http://localhost:7761',
        changeOrigin: true,
      },
    },
  },
});
