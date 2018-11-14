'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    defaultAssets = require('./config/assets/default'),
    testAssets = require('./config/assets/test'),
    // testConfig = require('./config/env/test'),
    webpack = require('webpack'),
    webpackConfig = require('./config/webpack/webpack.config'),
    merge = require('webpack-merge'),
    karmaReporters = ['mocha'];

// Karma configuration
module.exports = function (karmaConfig) {
  var configuration = {
    frameworks: ['jasmine'],

    preprocessors: {
      'config/webpack/entries/main.js': ['webpack'],
      'modules/*/tests/client/**/*.js': ['webpack'],
      'modules/*/client/views/**/*.html': ['ng-html2js']
    },

    webpack: merge(webpackConfig, {
      plugins: [
        new webpack.DefinePlugin({
          module: 'angular.mock.module'
        })
      ]
    }),

    ngHtml2JsPreprocessor: {
      moduleName: 'trustroots',

      cacheIdFromPath: function (filepath) {
        return filepath;
      }
    },

    // List of files / patterns to load in the browser
    files: [
      'config/webpack/entries/main.js',
      require.resolve('angular-mocks'),
    ].concat(testAssets.tests.client),

    // Test results reporter to use
    // Possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: karmaReporters,

    // Web server port
    port: 9876,

    // Enable / disable colors in the output (reporters and logs)
    colors: true,

    // Level of logging
    // Possible values: karmaConfig.LOG_DISABLE || karmaConfig.LOG_ERROR || karmaConfig.LOG_WARN || karmaConfig.LOG_INFO || karmaConfig.LOG_DEBUG
    logLevel: karmaConfig.LOG_INFO,

    // Enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['Chrome'],
    customLaunchers: {
      Chrome_travis_ci: {
        base: 'Chrome',
        flags: ['--no-sandbox']
      }
    },

    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,

    // Continuous Integration mode
    // If true, it capture browsers, run tests and exit
    singleRun: true
  };

  if (process.env.TRAVIS) {
    configuration.browsers = ['Chrome_travis_ci'];
  }

  karmaConfig.set(configuration);
};
