// Builds the component fixture page with the web client's Vite config, so
// components are compiled exactly as in the app. VISUAL_FIXTURES_OUT_DIR
// names the output directory.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';

import appConfig from '../../../vite.config.mts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.VISUAL_FIXTURES_OUT_DIR;
if (!outDir) throw new Error('VISUAL_FIXTURES_OUT_DIR is required.');

// The fixture page links each branch's own stylesheets, so the app's RTL
// stylesheet plugin, which expects the app's CSS in the bundle, is left out.
const plugins = (appConfig.plugins ?? [])
  .flat()
  .filter(
    plugin =>
      !(
        plugin &&
        typeof plugin === 'object' &&
        'name' in plugin &&
        plugin.name === 'trustroots-rtl-stylesheet'
      ),
  );

const config = mergeConfig(
  { ...appConfig, plugins },
  defineConfig({
    base: './',
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      manifest: false,
      rolldownOptions: {
        output: { entryFileNames: 'fixtures.js' },
      },
    },
  }),
);

// mergeConfig would keep the app's own entry next to the fixtures one.
config.build!.rolldownOptions!.input = { fixtures: resolve(here, 'entry.tsx') };

export default config;
