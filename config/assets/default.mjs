let service = {};
service = {
  server: {
    fontelloConfig: 'modules/core/client/fonts/fontello/config.json',
    workerJS: ['worker.js', 'config/**/*.{js,mjs}'],
    allJS: [
      'server.js',
      'config/**/*.{js,mjs}',
      'modules/*/server/**/*.mjs',
      'modules/*/server/**/*.mjs',
    ],
    models: 'modules/*/server/models/**/*.mjs',
    routes: [
      'modules/!(core)/server/routes/**/*.mjs',
      'modules/core/server/routes/**/*.mjs',
    ],
    config: 'modules/*/server/config/*.mjs',
    policies: 'modules/*/server/policies/*.mjs',
    views: 'modules/*/server/views/*.html',
  },
};
export default service;
export { service as 'module.exports' };
