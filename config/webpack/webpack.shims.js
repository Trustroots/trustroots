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
 */

const webpack = require('webpack');

const { join } = require('path');

const config = require('../config');

const basedir = join(__dirname, '../..');

function requireResolve(name) {
  return require.resolve(join(basedir, name));
}

module.exports = {
  resolve: {
    alias: {
      'uib-templates': requireResolve('public/dist/uib-templates'),
      angular: requireResolve('public/lib/angular/angular.js')
    }
  },
  module: {
    rules: [

      // Make angular available to the templates
      {
        test: requireResolve('public/lib/angular/angular.js'),
        loader: `exports-loader?angular`
      },
      {
        test: requireResolve('public/dist/uib-templates'),
        loader: `imports-loader?angular=${requireResolve('public/lib/angular/angular')}`
      },


      // Allow access to PruneClusterForLeaflet PruneCluster from outside the module
      {
        test: requireResolve('public/lib/PruneCluster/dist/PruneCluster'),
        loader: `exports-loader?PruneClusterForLeaflet,PruneCluster`
      },

      // Ensure the "trustroots" angular module is defined before we define the "core" one
      {
        test: requireResolve('modules/core/client/core.client.module'),
        loader: `imports-loader?_=${requireResolve('modules/core/client/app/init')}`
      },

      // Ensure the "core" angular module is defined before we define the templates
      {
        test: requireResolve('public/dist/uib-templates'),
        loader: `imports-loader?_=${requireResolve('modules/core/client/core.client.module')}`
      },

      // Import all the existing dependencies (from assets/*)
      {
        test: require.resolve('./main'),
        use: config.files.webpack.js.map(filename => {
          return `imports-loader?_=${requireResolve(filename)}`;
        })
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      L: requireResolve('/public/lib/leaflet'),
      jQuery: 'jquery',
      $: 'jquery',
      'window.jQuery': 'jquery',
      moment: 'moment',
      AppConfig: requireResolve('modules/core/client/app/config'),
      PruneClusterForLeaflet: [requireResolve('public/lib/PruneCluster/dist/PruneCluster'), 'PruneClusterForLeaflet'],
      PruneCluster: [requireResolve('public/lib/PruneCluster/dist/PruneCluster'), 'PruneCluster'],
      MediumEditor: requireResolve('public/lib/medium-editor/dist/js/medium-editor')
    })
  ]
};
