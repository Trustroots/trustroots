const webpack = require('webpack');
const { join } = require('path');

const basedir = join(__dirname, '../..');

const config = require('../config');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: require.resolve('./entries/pushMessagingServiceWorker'),
  output: {
    path: join(basedir, 'public'),
    filename: 'push-messaging-sw.js'
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'eslint-loader'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                corejs: 2,
                modules: 'commonjs',
                useBuiltIns: 'usage'
              }],
              ['@babel/preset-react']
            ],
            plugins: [
              '@babel/plugin-proposal-object-rest-spread'
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
};
