const { join } = require('path');

const basedir = join(__dirname, '../..');

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
};
