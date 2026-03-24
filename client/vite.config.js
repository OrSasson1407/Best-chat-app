import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
  build: {
    outDir: 'dist',
    // Increase the warning limit slightly since chat apps are naturally heavier
    chunkSizeWarningLimit: 600, 
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