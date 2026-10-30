// Builds the packages/ui fixture page with the web client's Vite config, so it
// gets the same Bootstrap + Less + Tailwind stylesheet and generated RTL file.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';

import appConfig from '../../../vite.config.mts';

const here = fileURLToPath(new URL('.', import.meta.url));

export default mergeConfig(
  appConfig,
  defineConfig({
    base: './',
    build: {
      outDir: resolve(here, 'dist'),
      emptyOutDir: true,
      sourcemap: false,
      rolldownOptions: {
        input: { 'react-main': resolve(here, 'harness.tsx') },
      },
    },
  }),
);
