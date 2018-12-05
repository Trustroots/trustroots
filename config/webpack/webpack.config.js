const webpack = require('webpack');
const merge = require('webpack-merge');

const { join } = require('path');

const shims = require('./webpack.shims');
const basedir = join(__dirname, '../..');

const config = require('../config');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = merge(shims, {
  mode: isProduction ? 'production' : 'development',
  entry: require.resolve('./entries/main'),
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
        use: [{
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                useBuiltIns: 'usage',
                modules: 'commonjs'
              }],
              ['@babel/preset-react']
            ],
            plugins: [
              '@babel/plugin-proposal-object-rest-spread',
              'angularjs-annotate'
            ]
          }
        }]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'FCM_SENDER_ID': JSON.stringify(config.fcm.senderId)
    })
  ]
});
