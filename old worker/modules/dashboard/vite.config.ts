import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin()
  ],
  build: {
    outDir: resolve(__dirname, '../javascript'),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'BotDashboard',
      formats: ['iife'],
      fileName: () => 'dashboard.js'
    },
    rollupOptions: {
      output: {
        extend: true,
      }
    }
  }
});
