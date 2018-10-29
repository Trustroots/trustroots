const merge = require('webpack-merge');

const { join } = require('path');

const shims = require('./webpack.shims');
const basedir = join(__dirname, '../..');

module.exports = merge(shims, {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: require.resolve('./main'),
  output: {
    path: join(basedir, 'public/assets')
  }
});
