/*
 *  Legacy webpack shims for libraries that expect globals.
 *  The goal would be to eventually remove this file.
 */

const webpack = require('webpack');

module.exports = {
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
