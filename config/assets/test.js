'use strict';

var _ = require('lodash'),
    path = require('path'),
    defaultAssets = require(path.resolve('./config/assets/default'));

module.exports = {
  client: {
    lib: {
      css: defaultAssets.client.lib.css,
      js: _.union(defaultAssets.client.lib.js, [
        'public/lib/angulartics-google-analytics/lib/angulartics-google-analytics.js'
      ]),
      less: defaultAssets.client.lib.less,
      tests: defaultAssets.client.lib.tests
    },
    less: defaultAssets.client.less,
    js: defaultAssets.client.js,
    views: defaultAssets.client.views
  },
  tests: {
    client: ['modules/*/tests/client/**/*.js'],
    server: ['modules/*/tests/server/**/*.js'],
    e2e: ['modules/*/tests/e2e/**/*.js']
  }
};
