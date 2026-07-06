import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5336,
    proxy: {
      '/api': 'http://localhost:5335',
      '/ocr-assets': 'http://localhost:5335',
      '/auth': 'http://localhost:5335'
    }
  }
});
