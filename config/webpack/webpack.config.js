const webpack = require('webpack');
const merge = require('webpack-merge');

const { join } = require('path');

const shims = require('./webpack.shims');
const basedir = join(__dirname, '../..');

module.exports = merge(shims, {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: require.resolve('./main'),
  output: {
    path: join(basedir, 'public/assets')
  },
  resolve: {
    alias: {
      '@': basedir
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'ng-annotate-loader?ngAnnotate=ng-annotate-patched'
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    })
  ]
});
