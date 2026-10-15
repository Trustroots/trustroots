import type { Configuration } from 'webpack';

/*
 *  Legacy webpack shims for libraries that expect globals.
 *  The goal would be to eventually remove this file.
 */

const webpack = require('webpack');

const shims: Configuration = {
  plugins: [
    new webpack.ProvidePlugin({
      L: require.resolve('leaflet'),
      jQuery: require.resolve('jquery'),
      $: require.resolve('jquery'),
      'window.jQuery': require.resolve('jquery'),
      moment: require.resolve('moment'),
      process: require.resolve('process/browser'),
    }),
  ],
};
module.exports = shims;
