'use strict';

var defaultAssets = require('./default');

module.exports = {
  client: {
    lib: {
      css: defaultAssets.client.lib.css,
      js: defaultAssets.client.lib.js
    },
    css: defaultAssets.client.css,
    js: ['public/dist/application.js']
  }
};
