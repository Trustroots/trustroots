/*
 *  This is some additional webpack configuration to handle "legacy" libaries/dependencies.
 *
 *  In the old days libaries had no way to specify their dependencies and you had to ensure you loaded
 *  them in the correct order. They would make things available globally for the other libaries to use.
 *
 *  In this brave new world each module (basiclaly each js file) is isolated from all the others.
 *  To solve this we have to specify various shim loaders to import/export the right variables.
 *
 *  We also define various "globals" with the ProvidePlugin - this just rewrites any global references
 *  to an equivalent module import.
 *
 *  The goal would be to eventually remove this file.
 *
 *  `require.resolve` is for files that are installed via package.json into node_modules
 *  `localResolve` is for files that are in the project repo (relative to root dir)
 */

const webpack = require('webpack');

const { join } = require('path');

const config = require('../config');

const basedir = join(__dirname, '../..');

function localResolve(name) {
  return require.resolve(join(basedir, name));
}

module.exports = {
  module: {
    rules: [
      // Make angular available to the templates
      {
        test: localResolve('public/dist/uib-templates'),
        loader: 'imports-loader?angular'
      },

      // Allow access to PruneClusterForLeaflet PruneCluster from outside the module
      {
        test: require.resolve('prunecluster/dist/PruneCluster'),
        loader: 'exports-loader?PruneClusterForLeaflet,PruneCluster'
      },

      // Ensure the "trustroots" angular module is defined before we define the "core" one
      {
        test: localResolve('modules/core/client/core.client.module'),
        loader: `imports-loader?_=${localResolve('modules/core/client/app/init')}`
      },

      // Ensure the "core" angular module is defined before we define the templates
      {
        test: localResolve('public/dist/uib-templates'),
        loader: `imports-loader?_=${localResolve('modules/core/client/core.client.module')}`
      },

      // Import all the existing dependencies (from assets/*)
      {
        test: require.resolve('./entries/main'),
        use: config.files.webpack.js.map(filename => {
          return `imports-loader?_=${localResolve(filename)}`;
        })
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      L: require.resolve('leaflet'),
      jQuery: require.resolve('jquery'),
      $: require.resolve('jquery'),
      'window.jQuery': require.resolve('jquery'),
      moment: require.resolve('moment'),
      AppConfig: localResolve('modules/core/client/app/config'),
      PruneClusterForLeaflet: [require.resolve('prunecluster/dist/PruneCluster'), 'PruneClusterForLeaflet'],
      PruneCluster: [require.resolve('prunecluster/dist/PruneCluster'), 'PruneCluster'],
      MediumEditor: require.resolve('medium-editor/dist/js/medium-editor')
    })
  ]
};
