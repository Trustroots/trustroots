import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import inject from '@rollup/plugin-inject';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('.', import.meta.url));
const apiTarget = process.env.TRUSTROOTS_API_URL || 'http://localhost:3001';
const port = Number(process.env.PORT) || 3000;

export default defineConfig({
  base: '/assets/',
  root,
  plugins: [
    react(),
    inject({
      L: 'leaflet',
      jQuery: 'jquery',
      $: 'jquery',
      moment: 'moment',
      process: 'process/browser',
    }),
  ],
  resolve: {
    alias: {
      '@': root,
      img: resolve(root, 'public/img'),
      less: resolve(root, 'modules/core/client/less'),
      modules: resolve(root, 'modules'),
      // Keep these CommonJS targets aligned with the current Webpack build.
      'nostr-tools/relay': require.resolve('nostr-tools/relay'),
      'nostr-tools/nip19': require.resolve('nostr-tools/nip19'),
      'tiny-warning': require.resolve('tiny-warning'),
      querystring: require.resolve('querystring-es3'),
      url: require.resolve('url/'),
    },
  },
  css: {
    postcss: {
      plugins: [require('autoprefixer')()],
    },
  },
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    proxy: {
      '^/(?!assets/).*': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: resolve(root, 'public/assets'),
    assetsDir: '.',
    emptyOutDir: false,
    manifest: 'vite-manifest.json',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        'react-main': resolve(root, 'config/vite/react-main.tsx'),
      },
      output: {
        entryFileNames: 'react-main.js',
        assetFileNames: assetInfo => {
          const extension = extname(assetInfo.name || '').toLowerCase();
          if (extension === '.css') return 'react-main.css';
          if (/\.(woff2?|eot|ttf|otf)$/.test(extension)) {
            return 'fonts/[name]-[hash][extname]';
          }

          return 'images/[name]-[hash][extname]';
        },
      },
    },
  },
});
