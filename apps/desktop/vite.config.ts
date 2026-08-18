import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@pizhou/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@pizhou/rules': path.resolve(__dirname, '../../packages/rules/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
