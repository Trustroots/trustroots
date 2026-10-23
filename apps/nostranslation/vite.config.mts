import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/nostranslation/',
  plugins: [react()],
  define: {
    __NOSTRANSLATION_API_URL__: JSON.stringify(
      process.env.VITE_NOSTRANSLATION_API_URL ??
        'https://nostranslation-api.trustroots.org',
    ),
  },
  build: { outDir: 'build', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 4311 },
});
