import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    root:'./',
    base:'./',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        './components': path.resolve(__dirname, '.'),
        '../components': path.resolve(__dirname, '.'),
        './data': path.resolve(__dirname, '.'),
        '../data': path.resolve(__dirname, '.'),
        './utils': path.resolve(__dirname, '.'),
        '../utils': path.resolve(__dirname, '.'),
        './audio': path.resolve(__dirname, 'audio.ts'),
        '../utils/audio': path.resolve(__dirname, 'audio.ts'),
        '../utils/three-setup': path.resolve(__dirname, 'three-setup.ts'),
        '../services/pubchem': path_resolve(__dirname, 'pubchem.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
