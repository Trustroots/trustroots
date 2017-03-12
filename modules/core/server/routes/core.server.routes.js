'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    facebookNotificationService = require(path.resolve('./modules/core/server/services/facebook-notification.server.service'));

module.exports = function(app) {
  // Root routing
  var core = require('../controllers/core.server.controller'),
      path = require('path'),
      tribes = require(path.resolve('./modules/tags/server/controllers/tribes.server.controller'));

  // CSP Violations
  // Note: If you’re using a CSRF module like csurf, you might have problems
  // handling these violations without a valid CSRF token. The fix is to put
  // your CSP report route above csurf middleware.
  // See `config/lib/express.js` and `initHelmetHeaders()` for more
  app.route('/api/report-csp-violation').post(core.receiveCSPViolationReport);

  // Return a 404 for all undefined api, module or lib routes
  app.route('/:url(api|modules|lib|developers)/*').get(core.renderNotFound);

  // Define a tribes route to ensure we'll pass tribe object to index
  // Object is passed to layout at `core.renderIndex()`
  app.route('/tribes/:tribeSlug').get(core.renderIndex);

  // Define application route
  app.route('/*').get(core.renderIndex);

  // When Facebook notifications are enabled
  // Embedding app in Facebook canvas iframe is enabled, but it uses `POST`

  if (facebookNotificationService.isNotificationsEnabled()) {
    app.route('/*').post(core.renderIndex);
  }

  // Finish by binding the tags middleware
  app.param('tribeSlug', tribes.tribeBySlug);

};
