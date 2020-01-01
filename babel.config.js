const compact = require('lodash/compact');

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  presets: [
    ['@babel/preset-env', {
      corejs: 2,
      modules: 'commonjs',
      useBuiltIns: 'usage'
    }],
    ['@babel/preset-react']
  ],
  plugins: compact([
    '@babel/plugin-proposal-object-rest-spread',
    'angularjs-annotate',
    isDevelopment && 'react-refresh/babel'
  ])
};
