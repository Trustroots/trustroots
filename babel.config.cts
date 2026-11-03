import type { BabelConfiguration } from './config/build-tool-types.mjs';

const babelConfig: BabelConfiguration = {
  presets: [
    [
      '@babel/preset-env',
      {
        corejs: '3.49',
        modules: 'commonjs',
        useBuiltIns: 'usage',
      },
    ],
    ['@babel/preset-react'],
    ['@babel/preset-typescript'],
  ],
  plugins: [
    // Transpile class fields consistently regardless of browser targets.
    '@babel/plugin-transform-class-properties',
  ],
};

interface BabelApi {
  version: string;
  cache: { using(callback: () => string): unknown };
}

// Stryker's instrumenter parses source with Babel 8, which picks up this file
// but cannot load the Babel 7 presets. It only parses, so give it nothing.
function config(api: BabelApi): BabelConfiguration | object {
  api.cache.using(() => api.version);
  return api.version.startsWith('7.') ? babelConfig : {};
}

module.exports = Object.assign(config, { babelConfig });
