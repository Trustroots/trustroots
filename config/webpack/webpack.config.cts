import type { Compiler, Configuration } from 'webpack';
import type { Config } from '../config.mts';
import type {} from 'webpack-dev-server';

interface WebpackPlugin {
  apply(compiler: Compiler): void;
}

type WebpackPluginConstructor = new (
  options?: Record<string, unknown>,
) => WebpackPlugin;
const BundleAnalyzerPlugin = (
  require('webpack-bundle-analyzer') as {
    BundleAnalyzerPlugin: WebpackPluginConstructor;
  }
).BundleAnalyzerPlugin;
const webpack = require('webpack') as typeof import('webpack');
const webpackMerge = require('webpack-merge') as typeof import('webpack-merge');
const compact = require('lodash/compact');
const MiniCssExtractPlugin =
  require('mini-css-extract-plugin') as typeof import('mini-css-extract-plugin');
const ESLintPlugin =
  require('eslint-webpack-plugin') as typeof import('eslint-webpack-plugin');

const WebpackRTLPlugin =
  require('@automattic/webpack-rtl-plugin') as new (options: {
    test: RegExp;
  }) => WebpackPlugin;

// This is very experimental library
// There might be another favourite react-refresh webpack plugin at some point ...
// See https://github.com/facebook/react/issues/16604 for discussion
const ReactRefreshWebpackPlugin =
  require('@pmmmwh/react-refresh-webpack-plugin') as typeof import('@pmmmwh/react-refresh-webpack-plugin');

const { join } = require('path');

const shims = require('./webpack.shims.cts');
const basedir = join(__dirname, '../..');
const {
  aliases,
  commonJsAliases,
  browserFallbacks,
  jsExtensionAlias,
} = require('../client/aliases.mts');

const config = require('./../config.mts') as Config;

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const devServerPort = Number(process.env.PORT) || 3000;
const devServerProxyTarget =
  process.env.TRUSTROOTS_API_URL || 'http://localhost:3001';

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

const webpackConfig = webpackMerge.merge(shims, {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
  entry: {
    'react-main': require.resolve('./entries/react-main.tsx'),
  },
  output: {
    path: join(basedir, 'public/assets'),
    publicPath: '/assets/',
    filename: '[name].js',
  },
  devServer: {
    host: config.host,
    port: devServerPort,
    static: false,
    devMiddleware: {
      index: false,
      publicPath: '/assets/',
    },
    proxy: [
      {
        context: () => true,
        target: devServerProxyTarget,
      },
    ],
    // @pmmmwh/react-refresh-webpack-plugin is setting up an overlay too
    // which seems a bit cheeky for a plugin to do, but we don't want two!
    client: {
      overlay: false,
    },
  },
  resolve: {
    // Preserve TypeScript resolution for the Webpack fallback.
    extensions: ['.ts', '.tsx', '.js', '.json', '.wasm'],
    // Preserve explicit JavaScript imports while client modules move to TypeScript.
    extensionAlias: { '.js': jsExtensionAlias },
    fallback: browserFallbacks,
    alias: {
      ...aliases,
      ...Object.fromEntries(
        Object.entries(commonJsAliases).map(([name, filename]) => [
          `${name}$`,
          filename,
        ]),
      ),
      // The Webpack fallback also uses the package's CommonJS root entry.
      'nostr-tools$': require.resolve('nostr-tools'),
    },
  },
  module: {
    rules: [
      {
        // Babel converts these ESM-only packages to CommonJS for supported
        // browsers. Let Webpack provide the CommonJS exports object too.
        test: /node_modules[\\/](?:@noble|@scure)[\\/].*\.js$/,
        type: 'javascript/auto',
      },
      {
        test: /\.(?:[jt]sx?|mts)$/,
        // Babel emits CommonJS imports for application modules. Parse both
        // module formats so Webpack replaces generated require() calls.
        type: 'javascript/auto',
        // Transpile our own code, plus the modern-syntax dependencies that
        // must match the application's supported browser targets.
        exclude: /node_modules[\\/](?!(nostr-tools|@noble|@scure)[\\/])/,
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
        // Asset modules export the URL for both ES module imports and
        // CommonJS requires, while keeping url-loader's inline size limit.
        type: 'asset',
        parser: {
          dataUrlCondition: { maxSize: 10000 },
        },
        generator: {
          dataUrl: { encoding: 'base64' },
          filename: 'fonts/[name].[hash:7][ext]',
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: { maxSize: 10000 },
        },
        generator: {
          dataUrl: { encoding: 'base64' },
          filename: 'images/[name]-[hash:7][ext]',
        },
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
            options: {
              // Keep the default build on Less 3 while Vite trials Less 4.
              implementation: require('less-webpack'),
            },
          },
        ],
      },
    ],
  },
  plugins: compact([
    !process.env.TRUSTROOTS_WEBPACK_SKIP_ESLINT && new ESLintPlugin(),
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
} satisfies Configuration);

module.exports = webpackConfig;
