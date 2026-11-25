interface AssetConfig {
  server: {
    fontelloConfig: string;
    workerJS: string[];
    allJS: string[];
    config: string;
    views: string;
  };
}

const service = {
  server: {
    fontelloConfig: 'modules/core/client/fonts/fontello/config.json',
    workerJS: ['worker.mjs', 'config/**/*.{js,mts}'],
    allJS: [
      'server.js',
      'config/**/*.{js,mts}',
      'layers/server/**/*.mts',
      'modules/*/server/**/*.{cjs,mts}',
    ],
    config: 'modules/*/server/config/*.mts',
    views: 'modules/*/server/views/*.html',
  },
} satisfies AssetConfig;
export default service;
