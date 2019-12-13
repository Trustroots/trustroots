const webpack = require('webpack');
const merge = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const { join } = require('path');

const shims = require('./webpack.shims');
const basedir = join(__dirname, '../..');

const config = require('../config');

const isProduction = process.env.NODE_ENV === 'production';

// @TODO add autoprefixer and gulp csso equivelents
const styleLoaders = [
  isProduction ? {
    loader: MiniCssExtractPlugin.loader
  } : {
    loader: 'style-loader'
  },
  {
    loader: 'css-loader'
  }
];

module.exports = merge(shims, {
  mode: isProduction ? 'production' : 'development',
  entry: require.resolve('./entries/main'),
  output: {
    path: join(basedir, 'public/assets')
  },
  resolve: {
    alias: {
      '@': basedir,

      // These are (mainly) to use within less/css files
      'img': join(basedir, 'public/img'),
      'less': join(basedir, 'modules/core/client/less'),
      'modules': join(basedir, 'modules')
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
                corejs: 2,
                modules: 'commonjs',
                useBuiltIns: 'usage'
              }],
              ['@babel/preset-react']
            ],
            plugins: [
              '@babel/plugin-proposal-object-rest-spread',
              'angularjs-annotate'
            ]
          }
        }]
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: '[name].[hash:7].[ext]',
          outputPath: 'fonts/'
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 10000,
              name: '[name]-[hash:7].[ext]',
              outputPath: 'images/'
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: styleLoaders
      },
      {
        test: /\.less$/,
        use: [
          ...styleLoaders,
          {
            loader: 'less-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    ...(isProduction ? [new MiniCssExtractPlugin({
      filename: 'main.css'
    })] : []),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'FCM_SENDER_ID': JSON.stringify(config.fcm.senderId)
    })
  ]
});
