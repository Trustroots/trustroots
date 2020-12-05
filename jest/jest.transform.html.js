/*
 * This is a bit of a hack, using webpack loaders to transform templates in jest.
 */

/*
const templateLoader = require('../config/webpack/templateloader');
const htmlLoader = require('html-loader');

module.exports = {
  process(src, filename) {
    return templateLoader.call(
      { resourcePath: filename },
      htmlLoader.call({ resourcePath: filename }, src),
    );
  },
};
*/

module.exports = {
  // eslint-disable-next-line no-unused-vars
  process(src, filename, config, options) {
    return filename;
  },
};
