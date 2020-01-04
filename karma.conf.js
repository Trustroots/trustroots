/**
 * External dependencies.
 */
const webpackMerge = require('webpack-merge');
const webpack = require('webpack');
const webpackConfig = require('./config/webpack/webpack.config');

// Karma configuration
// https://karma-runner.github.io/4.0/config/configuration-file.html
module.exports = (karmaConfig) => {
  karmaConfig.set({
    frameworks: ['jasmine'],
    preprocessors: {
      'config/webpack/entries/main.js': ['webpack'],
      'modules/*/tests/client/*.js': ['webpack'],
    },
    webpack: webpackMerge(webpackConfig, {
      plugins: [
        new webpack.DefinePlugin({
          module: 'angular.mock.module',
        }),
      ],
    }),
    // List of files / patterns to load in the browser
    files: [
      'config/webpack/entries/main.js',
      require.resolve('angular-mocks'),
      'modules/*/tests/client/*.js',
    ],
    reporters: ['mocha'],
    port: 9876,
    // Possible values: karmaConfig.LOG_DISABLE || karmaConfig.LOG_ERROR || karmaConfig.LOG_WARN || karmaConfig.LOG_INFO || karmaConfig.LOG_DEBUG
    logLevel: karmaConfig.LOG_INFO,
    browsers: ['ChromeHeadless'],
    flags: ['--no-sandbox'],
    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,
  });
};
