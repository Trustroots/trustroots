let service = {};
service = {
  server: {
    fontelloConfig: 'modules/core/client/fonts/fontello/config.json',
    workerJS: ['worker.{js,mjs,mts}', 'config/**/*.{js,mjs,mts}'],
    allJS: [
      'server.js',
      'config/**/*.{js,mjs,mts}',
      'modules/*/server/**/*.{mjs,mts}',
    ],
    models: 'modules/*/server/models/**/*.{mjs,mts}',
    routes: [
      'modules/!(core)/server/routes/**/*.{mjs,mts}',
      'modules/core/server/routes/**/*.{mjs,mts}',
    ],
    config: 'modules/*/server/config/*.{mjs,mts}',
    policies: 'modules/*/server/policies/*.{mjs,mts}',
    views: 'modules/*/server/views/*.html',
  },
};
export default service;
export { service as 'module.exports' };
