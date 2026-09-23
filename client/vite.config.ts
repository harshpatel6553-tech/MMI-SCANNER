import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://35.226.242.164.sslip.io',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'https://35.226.242.164.sslip.io',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
