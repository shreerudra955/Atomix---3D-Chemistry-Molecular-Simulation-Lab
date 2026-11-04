import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: './',
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': '.',
        './components': '.',
        '../components': '.',
        './data': '.',
        '../data': '.',
        './utils': '.',
        '../utils': '.',
        './services': '.',
        '../services': '.',
        './audio': 'audio.ts',
        '../utils/audio': 'audio.ts',
        '../utils/three-setup': 'three-setup.ts',
        '../services/pubchem': 'pubchem.ts',
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
