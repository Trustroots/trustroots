import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

import inject from '@rollup/plugin-inject';
import react from '@vitejs/plugin-react';
import { defineConfig, transformWithOxc } from 'vite';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('.', import.meta.url));
const apiTarget = process.env.TRUSTROOTS_API_URL || 'http://localhost:3001';
const port = Number(process.env.PORT) || 3000;

// Existing React components use JSX in .js files. Vite treats those as plain
// JavaScript unless they are transformed before its normal source transform.
const legacyJsx = {
  name: 'trustroots-legacy-jsx',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.startsWith(resolve(root, 'modules') + '/') || !id.endsWith('.js')) {
      return null;
    }

    return transformWithOxc(code, id.replace(/\.js$/, '.jsx'));
  },
};

// Less 3 still uses Webpack-style ~ imports throughout the client styles.
const legacyLessImports = {
  install(less, pluginManager) {
    class LegacyAliasFileManager extends less.FileManager {
      supports(filename) {
        return /^~(?:less|modules|bootstrap|mapbox-gl)\//.test(filename);
      }

      async loadFile(filename, _currentDirectory, options) {
        const [, alias, path] = /^~([^/]+)\/(.*)$/.exec(filename);
        const base = {
          less: resolve(root, 'modules/core/client/less'),
          modules: resolve(root, 'modules'),
          bootstrap: resolve(root, 'node_modules/bootstrap'),
          'mapbox-gl': resolve(root, 'node_modules/mapbox-gl'),
        }[alias];
        const resolved = this.tryAppendExtension(
          resolve(base, path),
          options.ext,
        );
        return {
          filename: resolved,
          contents: await readFile(resolved, 'utf8'),
        };
      }
    }

    pluginManager.addFileManager(new LegacyAliasFileManager());
  },
};

const legacyCssImports = {
  name: 'trustroots-legacy-css-imports',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('.less')) return null;

    return code.replace(
      /@import ['"]~([^/'"]+)\/([^'"]+\.css)['"];/g,
      (_, alias, path) => {
        const base = alias === 'modules' ? root : resolve(root, 'node_modules');
        const filename = resolve(base, alias, path);
        return `@import (inline) '${filename}';`;
      },
    );
  },
};

export default defineConfig({
  base: '/assets/',
  root,
  plugins: [
    legacyJsx,
    legacyCssImports,
    react(),
    inject({
      include:
        /\/(?:modules|config\/client|config\/vite)\/.*\.(?:[cm]?js|[jt]sx?)(?:\?.*)?$/,
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
      '~img': resolve(root, 'public/img'),
      '~modules': resolve(root, 'modules'),
      '~bootstrap': resolve(root, 'node_modules/bootstrap'),
      // Keep these CommonJS targets aligned with the current Webpack build.
      'nostr-tools/relay': require.resolve('nostr-tools/relay'),
      'nostr-tools/nip19': require.resolve('nostr-tools/nip19'),
      'tiny-warning': require.resolve('tiny-warning'),
      querystring: require.resolve('querystring-es3'),
      url: require.resolve('url/'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        plugins: [legacyLessImports],
        modifyVars: { 'icon-font-path': '"~bootstrap/fonts/"' },
      },
    },
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
