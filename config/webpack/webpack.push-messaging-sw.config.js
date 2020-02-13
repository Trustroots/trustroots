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
    filename: 'push-messaging-sw.js',
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      FCM_SENDER_ID: JSON.stringify(config.fcm.senderId),
    }),
  ],
};
