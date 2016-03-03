'use strict';

var defaultAssets = require('./default');

module.exports = {
  client: {
    lib: {
      css: defaultAssets.client.lib.css,
      js: defaultAssets.client.lib.js
    }
  }
};
