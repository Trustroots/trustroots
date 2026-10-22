import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

import react from '@vitejs/plugin-react';
import { defineConfig, transformWithOxc } from 'vite';

import config from './config/config.mts';
import clientAliases from './config/client/aliases.mts';
import { rtlStylesheetPlugin } from './config/vite/rtl-stylesheet.mts';

const require = createRequire(import.meta.url);
const inject =
  require('@rollup/plugin-inject') as typeof import('@rollup/plugin-inject').default;
const { aliases, commonJsAliases } = clientAliases;
const root = fileURLToPath(new URL('.', import.meta.url));
const apiTarget = process.env.TRUSTROOTS_API_URL || 'http://localhost:3001';
const port = Number(process.env.PORT) || 3000;

interface LegacyAliasFileManager {
  supports(filename: string): boolean;
  tryAppendExtension(filename: string, extension: string): string;
  loadFile(
    filename: string,
    currentDirectory: string,
    options: { ext: string },
  ): Promise<{ filename: string; contents: string }>;
}

// Existing React components use JSX in .js files. Vite treats those as plain
// JavaScript unless they are transformed before its normal source transform.
const legacyJsx = {
  name: 'trustroots-legacy-jsx',
  enforce: 'pre',
  async transform(code: string, id: string) {
    if (!id.startsWith(resolve(root, 'modules') + '/') || !id.endsWith('.js')) {
      return null;
    }

    return transformWithOxc(code, id.replace(/\.js$/, '.jsx'));
  },
};

// Client styles still use legacy ~ imports.
const legacyLessImports = {
  install(
    less: { FileManager: new () => LegacyAliasFileManager },
    pluginManager: { addFileManager(manager: LegacyAliasFileManager): void },
  ) {
    class LegacyAliasFileManager extends less.FileManager {
      supports(filename: string): boolean {
        return /^~(?:less|modules|bootstrap|mapbox-gl)\//.test(filename);
      }

      async loadFile(
        filename: string,
        _currentDirectory: string,
        options: { ext: string },
      ) {
        const match = /^~([^/]+)\/(.*)$/.exec(filename);
        if (!match) throw new Error(`Invalid stylesheet alias "${filename}".`);
        const [, alias, path] = match;
        if (!alias || !path) {
          throw new Error(`Invalid stylesheet alias "${filename}".`);
        }
        const base: Record<string, string> = {
          less: aliases.less,
          modules: aliases.modules,
          bootstrap: resolve(root, 'node_modules/bootstrap'),
          'mapbox-gl': resolve(root, 'node_modules/mapbox-gl'),
        };
        const directory = base[alias];
        if (!directory)
          throw new Error(`No stylesheet directory for "~${alias}/".`);
        const resolved = this.tryAppendExtension(
          resolve(directory, path),
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
  transform(code: string, id: string) {
    if (!id.endsWith('.less')) return null;

    const transformed = code.replace(
      /@import ['"]~([^/'"]+)\/([^'"]+\.css)['"];/g,
      (_, alias, path) => {
        // `modules` is the source tree. Other `~name/*.css` imports are npm
        // packages. `less` is both a source alias and a package, so it must
        // not be taken from the shared alias map here.
        const base =
          alias === 'modules'
            ? aliases.modules
            : resolve(root, 'node_modules', alias);
        const filename = resolve(base, path);
        return `@import (inline) '${filename}';`;
      },
    );
    if (transformed === code) return null;

    return {
      code: transformed,
      map: { mappings: '' },
    };
  },
};

export default defineConfig({
  base: '/assets/',
  root,
  // Express owns public files; copying public/ into public/assets would nest it.
  publicDir: false,
  plugins: [
    legacyJsx,
    legacyCssImports,
    rtlStylesheetPlugin(),
    react(),
    inject({
      include:
        /\/(?:modules|config\/client|config\/vite)\/.*\.(?:[cm]?js|[jt]sx?)(?:\?.*)?$/,
      L: 'leaflet',
      moment: 'moment',
      process: 'process/browser',
    }),
  ],
  resolve: {
    alias: {
      ...aliases,
      '~img': aliases.img,
      '~modules': aliases.modules,
      '~bootstrap': resolve(root, 'node_modules/bootstrap'),
      ...commonJsAliases,
    },
  },
  optimizeDeps: {
    // Source transforms do not run during the dependency scan. Legacy .js
    // components contain JSX.
    include: ['process/browser'],
    rolldownOptions: {
      moduleTypes: { '.js': 'jsx' },
      // Pre-bundled CommonJS dependencies can also use Node's process global.
      transform: { inject: { process: 'process/browser' } },
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        // Preserve the unparenthesised division used by our Less 3 styles.
        math: 'always',
        plugins: [legacyLessImports],
        modifyVars: { 'icon-font-path': '"~bootstrap/fonts/"' },
      },
    },
    postcss: {
      plugins: [require('autoprefixer')()],
    },
  },
  server: {
    // Honour the configured bind address, including local.js.
    host: config.host,
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
    // Inline small assets while keeping larger files independently cacheable.
    assetsInlineLimit: 10000,
    sourcemap: true,
    manifest: 'vite-manifest.json',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        'react-main': resolve(root, 'config/vite/react-main.tsx'),
      },
      output: {
        // Express serves the production entry with a classic script tag.
        format: 'iife',
        entryFileNames: 'react-main.js',
        assetFileNames: (assetInfo: { name?: string }) => {
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
