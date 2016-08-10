'use strict';

/**
 * Module dependencies.
 */
var tagsPolicy = require('../policies/tags.server.policy'),
    tribes = require('../controllers/tribes.server.controller'),
    tags = require('../controllers/tags.server.controller');

module.exports = function(app) {

  app.route('/api/tags').all(tagsPolicy.isAllowed)
    .post(tags.createTag)
    .get(tags.listTags);

  app.route('/api/tribes').all(tagsPolicy.isAllowed)
    .get(tribes.listTribes);

  app.route('/api/tags/:tagSlug').all(tagsPolicy.isAllowed)
    .get(tags.getTag);

  app.route('/api/tribes/:tribeSlug').all(tagsPolicy.isAllowed)
    .get(tribes.getTribe);

  // Finish by binding the tags middleware
  app.param('tagSlug', tags.tagBySlug);
  app.param('tribeSlug', tribes.tribeBySlug);
};
