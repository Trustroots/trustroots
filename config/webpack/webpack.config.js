const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const compact = require('lodash/compact');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// When upgrading to Webpack 5, you might consider swapping this to `@automattic/webpack-rtl-plugin` (fork) because the original isn't maintained anymore
const WebpackRTLPlugin = require('webpack-rtl-plugin');

// This is very experimental library
// There might be another favourite react-refresh webpack plugin at some point ...
// See https://github.com/facebook/react/issues/16604 for discussion
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const { join, resolve } = require('path');

const shims = require('./webpack.shims');
const basedir = join(__dirname, '../..');

const config = require('../config');

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const styleLoaders = [
  isProduction
    ? {
        loader: MiniCssExtractPlugin.loader,
      }
    : {
        loader: 'style-loader',
      },
  {
    loader: 'css-loader',
    options: { importLoaders: 1 },
  },
  {
    loader: 'postcss-loader',
    options: {
      postcssOptions: {
        plugins: [require('autoprefixer')],
      },
      sourceMap: isDevelopment,
    },
  },
];

module.exports = webpackMerge.merge(shims, {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'cheap-module-eval-source-map',
  entry: require.resolve('./entries/main'),
  output: {
    path: join(basedir, 'public/assets'),
    publicPath: '/assets/',
  },
  devServer: {
    index: '',
    host: config.host,
    port: 3000,
    contentBase: false,
    publicPath: '/assets/',
    proxy: {
      context: () => true,
      target: 'http://localhost:3001',
    },
    // @pmmmwh/react-refresh-webpack-plugin is setting up an overlay too
    // which seems a bit cheeky for a plugin to do, but we don't want two!
    overlay: false,
  },
  resolve: {
    alias: {
      '@': basedir,

      // These are (mainly) to use within less/css files
      img: join(basedir, 'public', 'img'),
      less: join(basedir, 'modules', 'core', 'client', 'less'),
      modules: join(basedir, 'modules'),
    },
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        exclude: /node_modules/,
        test: /\.js$/,
        loader: 'eslint-loader',
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: [
                isDevelopment && require.resolve('react-refresh/babel'),
              ].filter(Boolean),
            },
          },
        ],
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: '[name].[hash:7].[ext]',
          outputPath: 'fonts/',
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 10000,
              name: '[name]-[hash:7].[ext]',
              outputPath: 'images/',
            },
          },
        ],
      },
      {
        test: /\.(html)$/,
        use: [
          {
            loader: resolve(__dirname + '/templateloader.js'),
          },
          {
            loader: 'html-loader',
            options: {
              minimize: true,
              attrs: ['img:src', ':ng-include'],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: styleLoaders,
      },
      {
        test: /\.less$/,
        use: [
          ...styleLoaders,
          {
            loader: 'less-loader',
          },
        ],
      },
    ],
  },
  plugins: compact([
    config.bundleAnalyzer.enabled &&
      new BundleAnalyzerPlugin(config.bundleAnalyzer.options),
    isProduction &&
      new MiniCssExtractPlugin({
        filename: 'main.css',
      }),
    // @TODO: run RTL also on inlined CSS?
    isProduction &&
      new WebpackRTLPlugin({
        diffOnly: true, // The stylesheet created will only contain the css that differs from the source stylesheet.
        filename: 'main.rtl.css',
        minify: isProduction,
      }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    isDevelopment && new ReactRefreshWebpackPlugin(),
  ]),
});
