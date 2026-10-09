import nunjucks from 'nunjucks';
import jsonForScript from './../../modules/core/server/services/json-for-script.server.service.mjs';
let service = {};
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
service = nunjucks.render;
export default service;
export { service as 'module.exports' };
