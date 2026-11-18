interface AssetConfig {
  server: {
    fontelloConfig: string;
    workerJS: string[];
    allJS: string[];
    models: string;
    routes: string[];
    config: string;
    policies: string;
    views: string;
  };
}

const service = {
  server: {
    fontelloConfig: 'modules/core/client/fonts/fontello/config.json',
    workerJS: ['worker.{js,mjs,mts}', 'config/**/*.{js,mjs,mts}'],
    allJS: [
      'server.js',
      'config/**/*.{js,mjs,mts}',
      'modules/*/server/**/*.{mjs,mts}',
    ],
    models: 'modules/*/server/models/**/*.{cjs,mts}',
    routes: [
      'modules/!(core)/server/routes/**/*.{cjs,mts}',
      'modules/core/server/routes/**/*.{cjs,mts}',
    ],
    config: 'modules/*/server/config/*.{mjs,mts}',
    policies: 'modules/*/server/policies/*.{mjs,mts}',
    views: 'modules/*/server/views/*.html',
  },
} satisfies AssetConfig;
export default service;
