const _ = require('lodash');
const path = require('path');
const defaultAssets = require(path.resolve('./config/assets/default'));

module.exports = {
  // Override any default asset blocks here or add new blocks
  client: {
    lib: {
      uibModuleTemplates: defaultAssets.client.lib.uibModuleTemplates,
      js: _.union(defaultAssets.client.lib.js, [
        'node_modules/angulartics-google-analytics/lib/angulartics-ga.js',
      ]),
      tests: defaultAssets.client.lib.tests,
    },
    js: _.union(defaultAssets.client.js, [
      'public/dist/uib-templates.js',
      'public/dist/templates.js',
    ]),
    views: defaultAssets.client.views,
  },
};
