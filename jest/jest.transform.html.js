/*
 * This is a bit of a hack, using webpack loaders to transform templates in jest.
 */

const templateLoader = require('../config/webpack/templateloader');
const htmlLoader = require('html-loader');

module.exports = {
  process(src, filename) {
    return templateLoader.call(
      {
        resourcePath: filename,
      },
      htmlLoader.call(
        {
          resourcePath: filename,
          query: {
            minimize: true,
            attrs: ['img:src', ':ng-include'],
          },
        },
        src,
      ),
    );
  },
};
