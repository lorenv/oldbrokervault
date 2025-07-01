// Deployment-compatible Vite config that bypasses hanging build issues
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  // Optimized build settings for static deployment
  build: {
    outDir: 'dist/client',
    emptyOutDir: false, // Don't clear dist folder (server files already there)
    rollupOptions: {
      // Minimal chunking to avoid complex bundling issues
      output: {
        manualChunks: undefined,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    // Faster builds
    minify: 'esbuild',
    target: 'es2020',
    // Prevent hanging during build
    chunkSizeWarningLimit: 2000
  },
  // Prevent dev server conflicts during build
  server: {
    port: 5001
  }
});