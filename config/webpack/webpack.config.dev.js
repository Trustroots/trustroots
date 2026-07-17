const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const compact = require('lodash/compact');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

const WebpackRTLPlugin = require('@automattic/webpack-rtl-plugin');

// This is very experimental library
// There might be another favourite react-refresh webpack plugin at some point ...
// See https://github.com/facebook/react/issues/16604 for discussion
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const { join } = require('path');

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
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
  entry: {
    'react-main': require.resolve('./entries/react-main'),
  },
  output: {
    path: join(basedir, 'public/assets'),
    publicPath: '/assets/',
    filename: '[name].js',
  },
  devServer: {
    host: config.host,
    port: 3000,
    static: false,
    devMiddleware: {
      index: false,
      publicPath: '/assets/',
    },
    proxy: [
      {
        context: () => true,
        target: 'http://localhost:80',
      },
    ],
    // @pmmmwh/react-refresh-webpack-plugin is setting up an overlay too
    // which seems a bit cheeky for a plugin to do, but we don't want two!
    client: {
      overlay: false,
    },
  },
  resolve: {
    fallback: {
      querystring: require.resolve('querystring-es3'),
      url: require.resolve('url/'),
    },
    alias: {
      '@': basedir,

      // These are (mainly) to use within less/css files
      img: join(basedir, 'public', 'img'),
      less: join(basedir, 'modules', 'core', 'client', 'less'),
      modules: join(basedir, 'modules'),

      // Use the CommonJS targets selected by nostr-tools' public exports.
      // Explicit aliases keep Webpack and ESLint's Webpack resolver aligned.
      'nostr-tools$': require.resolve('nostr-tools'),
      'nostr-tools/relay$': require.resolve('nostr-tools/relay'),
      'nostr-tools/nip19$': require.resolve('nostr-tools/nip19'),
    },
  },
  module: {
    rules: [
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
    new ESLintPlugin(),
    config.bundleAnalyzer.enabled &&
      new BundleAnalyzerPlugin(config.bundleAnalyzer.options),
    isProduction &&
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
    // @TODO: run RTL also on inlined CSS?
    isProduction && new WebpackRTLPlugin({ test: /react-main\.css$/ }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    isDevelopment && new ReactRefreshWebpackPlugin(),
  ]),
});
