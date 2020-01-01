module.exports = {
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
};
