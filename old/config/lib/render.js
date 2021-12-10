const nunjucks = require('nunjucks');

// Configure nunjucks
// https://mozilla.github.io/nunjucks/
nunjucks.configure('./modules/core/server/views', {
  watch: false,
  noCache: true,
});

/**
 * Template rendering function
 * https://mozilla.github.io/nunjucks/api.html#render
 */
module.exports = nunjucks.render;
