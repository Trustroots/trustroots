const fs = require('fs');

module.exports = {
  // eslint-disable-next-line no-unused-vars
  process(src, filename, config, options) {
    const html = fs.readFileSync(filename, { encoding: 'utf-8' });

    // Originally from Webpack html-loader
    // https://github.com/webpack-contrib/html-loader/blob/39e496670defcf0e0f6da9de91e91fe953f67d91/src/utils.js#L1204-L1208
    const code = JSON.stringify(html)
      // Invalid in JavaScript but valid HTML
      .replace(/[\u2028\u2029]/g, str =>
        str === '\u2029' ? '\\u2029' : '\\u2028',
      );

    return { code };
  },
};
