const { join } = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');

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
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [new ESLintPlugin()],
};
