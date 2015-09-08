'use strict';

var defaultAssets = require('./default');

module.exports = {
  client: {
    lib: {
      css: defaultAssets.client.lib.css,
      js: defaultAssets.client.lib.js
    },
    css: ['public/dist/application.min.css'],
    js: ['public/dist/application.min.js']
  }
};
