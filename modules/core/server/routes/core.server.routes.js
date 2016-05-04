'use strict';

module.exports = function(app) {
  // Root routing
  var core = require('../controllers/core.server.controller'),
      path = require('path'),
      tribes = require(path.resolve('./modules/tags/server/controllers/tribes.server.controller'));


  // Return a 404 for all undefined api, module or lib routes
  app.route('/:url(api|modules|lib|developers)/*').get(core.renderNotFound);

  // Define a tribes route to ensure we'll pass tribe object to index
  // Object is passed to layout at `core.renderIndex()`
  app.route('/tribes/:tribeSlug').get(core.renderIndex);

  // Define application route
  app.route('/*').get(core.renderIndex);

  // Finish by binding the tags middleware
  app.param('tribeSlug', tribes.tribeBySlug);

};
