import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Adds polyfills for Node.js built-ins like 'events', 'stream', and 'buffer'
    // This fixes the "[plugin vite:resolve] Module has been externalized" warnings
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
      // This maps '@' to your 'src' directory automatically
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  // Ensure 'global' maps to 'window' for older browserified libraries (like engine.io/socket.io-parser)
  define: {
    global: 'window',
  },
  optimizeDeps: {
    // Force Vite to pre-bundle socket.io-client to prevent CJS/ESM conflicts
    include: ['socket.io-client'],
  },
  build: {
    outDir: 'dist',
    // Increase the warning limit slightly since chat apps are naturally heavier
    chunkSizeWarningLimit: 600, 
    // Fixes the "Cannot set properties of undefined (setting 'encode')" error
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // This is the magic that fixes the 1MB Chunk warning!
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split out the heaviest libraries into their own files
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('socket.io')) return 'vendor-socket';
            if (id.includes('emoji-picker-react')) return 'vendor-emoji';
            if (id.includes('framer-motion')) return 'vendor-motion';
            
            // Group React core libraries together
            if (
              id.includes('react') || 
              id.includes('react-dom') || 
              id.includes('react-router')
            ) {
              return 'vendor-react';
            }
            
            // Everything else goes into a general vendor file
            return 'vendor-general'; 
          }
        }
      }
    }
  }
});