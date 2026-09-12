const nunjucks = require('nunjucks');
const jsonForScript = require('../../modules/core/server/services/json-for-script.server.service');

// Configure nunjucks
// https://mozilla.github.io/nunjucks/
const templates = nunjucks.configure('./modules/core/server/views', {
  watch: false,
  noCache: true,
});
templates.addFilter('jsonForScript', jsonForScript);

/**
 * Template rendering function
 * https://mozilla.github.io/nunjucks/api.html#render
 */
module.exports = nunjucks.render;
