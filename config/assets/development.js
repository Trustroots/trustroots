const _ = require('lodash');
const path = require('path');
const defaultAssets = require(path.resolve('./config/assets/default'));

module.exports = {
  // Override any default asset blocks here or add new blocks
  client: {
    lib: {
      uibModuleTemplates: defaultAssets.client.lib.uibModuleTemplates,
      js: _.union(defaultAssets.client.lib.js, [
        'node_modules/angulartics/src/angulartics-debug.js',
      ]),
      tests: defaultAssets.client.lib.tests,
    },
    js: defaultAssets.client.js,
    views: defaultAssets.client.views,
  },
};
