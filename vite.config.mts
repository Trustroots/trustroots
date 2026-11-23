import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import config from './config/config.mts';
import clientAliases from './config/client/aliases.mts';
import { rtlStylesheetPlugin } from './config/vite/rtl-stylesheet.mts';

const require = createRequire(import.meta.url);
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

// Client styles still use legacy ~ imports.
const legacyLessImports = {
  install(
    less: { FileManager: new () => LegacyAliasFileManager },
    pluginManager: { addFileManager(manager: LegacyAliasFileManager): void },
  ) {
    class LegacyAliasFileManager extends less.FileManager {
      supports(filename: string): boolean {
        return /^~(?:less|modules|bootstrap)\//.test(filename);
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

function startPlugins() {
  // Unit tests import the route source without Start's browser HMR code.
  if (process.env.VITEST === 'true') return [];

  return (
    tanstackStart({
      srcDirectory: 'layers/shell/client',
      router: {
        entry: 'start-router.tsx',
        basepath: '/',
      },
      client: { entry: '../../../config/vite/react-main.tsx' },
      // Prerendered to public/assets/_shell.html, which Express serves.
      spa: { enabled: true, maskPath: '/assets/' },
    })
      .flat(2)
      // In development Start prefixes every path outside /assets/ with that
      // base, before Vite's proxy could send it to Express.
      .filter(
        plugin =>
          !(
            plugin &&
            'name' in plugin &&
            plugin.name === 'tanstack-start-core:dev-base-rewrite'
          ),
      )
  );
}

export default defineConfig({
  base: '/assets/',
  root,
  // Express owns public files; copying public/ into public/assets would nest it.
  publicDir: false,
  plugins: [
    legacyCssImports,
    tailwindcss(),
    rtlStylesheetPlugin(),
    ...startPlugins(),
    react(),
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
  // Start prerenders the SPA shell through the preview server. Bind the
  // address it fetches, which in containers can differ from "localhost".
  preview: { host: '127.0.0.1', proxy: {} },
  environments: {
    client: {
      build: {
        outDir: resolve(root, 'public/assets'),
        rolldownOptions: {
          output: { entryFileNames: 'react-main-[hash].js' },
        },
      },
    },
    // Start prerenders the SPA shell with this bundle; Express serves pages.
    ssr: { build: { outDir: resolve(root, 'build/start-server') } },
  },
  build: {
    assetsDir: '.',
    emptyOutDir: false,
    // Inline small assets while keeping larger files independently cacheable.
    assetsInlineLimit: 10000,
    sourcemap: true,
    manifest: 'vite-manifest.json',
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
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
