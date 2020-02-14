module.exports = {
  server: {
    fontelloConfig: 'modules/core/client/fonts/fontello/config.json',
    gulpConfig: 'gulpfile.js',
    workerJS: ['worker.js', 'config/**/*.js'],
    allJS: ['server.js', 'config/**/*.js', 'modules/*/server/**/*.js'],
    models: 'modules/*/server/models/**/*.js',
    routes: [
      'modules/!(core)/server/routes/**/*.js',
      'modules/core/server/routes/**/*.js',
    ],
    config: 'modules/*/server/config/*.js',
    policies: 'modules/*/server/policies/*.js',
    views: 'modules/*/server/views/*.html',
    migrations: 'migrations/*.js',
  },
};
