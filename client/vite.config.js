import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Adds polyfills for Node.js built-ins like 'events', 'stream', and 'buffer'
    nodePolyfills({
      include: ['events', 'stream', 'util', 'buffer', 'crypto'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  // Ensure 'global' maps to 'window' for older browserified libraries
  define: {
    global: 'window',
  },
  optimizeDeps: {
    include: ['socket.io-client', 'engine.io-client', 'engine.io-parser'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600, 
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            
            // CRITICAL FIX: Group engine.io AND socket.io together!
            if (id.includes('socket.io') || id.includes('engine.io')) {
              return 'vendor-socket';
            }
            
            if (id.includes('emoji-picker-react')) return 'vendor-emoji';
            if (id.includes('framer-motion')) return 'vendor-motion';
            
            if (
              id.includes('react') || 
              id.includes('react-dom') || 
              id.includes('react-router')
            ) {
              return 'vendor-react';
            }
            
            return 'vendor-general'; 
          }
        }
      }
    }
  }
});