/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const facebookNotificationService = require(path.resolve(
  './modules/core/server/services/facebook-notification.server.service',
));
const core = require('../controllers/core.server.controller');
const tribes = require(path.resolve(
  './modules/tribes/server/controllers/tribes.server.controller',
));

module.exports = function (app) {
  const redirect = function (src, dst) {
    app.route(src).get(function (req, res) {
      res.redirect(301, dst);
    });
  };

  redirect('/invite', '/signup');
  redirect('/tribes/lgbt', '/circles/lgbtq');
  redirect('/tribes/vegans-vegetarians', '/circles/veg');

  // `/tribes/*` and `/faq/tribes` routes deprecated in August 2020
  // https://ideas.trustroots.org/2020/08/04/introducing-circles/
  redirect('/faq/tribes', '/faq/circles');
  redirect('/tribes', '/circles');
  app.route('/tribes/:tribe').get(function (req, res) {
    const tribe = _.get(req, ['tribe', 'slug']);
    const route = tribe ? '/circles/' + tribe : '/circles';
    res.redirect(301, route);
  });

  // Gives the service worker access to any config it needs
  app.route('/config/sw.js').get(core.renderServiceWorkerConfig);

  // CSP Violations
  // Note: If you’re using a CSRF module like csurf, you might have problems
  // handling these violations without a valid CSRF token. The fix is to put
  // your CSP report route above csurf middleware.
  // See `config/lib/express.js` and `initHelmetHeaders()` for more
  app.route('/api/report-csp-violation').post(core.receiveCSPViolationReport);

  // Excect CT Violations
  // Note: If you’re using a CSRF module like csurf, you might have problems
  // handling these violations without a valid CSRF token. The fix is to put
  // your CSP report route above csurf middleware.
  // See `config/lib/express.js` and `initHelmetHeaders()` for more
  app
    .route('/api/report-expect-ct-violation')
    .post(core.receiveExpectCTViolationReport);

  // Return a 404 for all undefined api, module or lib routes
  app.route('/:url(api|modules|lib|developers)/*').get(core.renderNotFound);

  // Define a tribes route to ensure we'll pass tribe object to index
  // Object is passed to layout at `core.renderIndex()`
  app.route('/circles/:tribe').get(core.renderIndex);

  // Define application route
  app.route('/*').get(core.renderIndex);

  // When Facebook notifications are enabled
  // Embedding app in Facebook canvas iframe is enabled, but it uses `POST`

  if (facebookNotificationService.isNotificationsEnabled()) {
    app.route('/*').post(core.renderIndex);
  }

  // Finish by binding the tribes middleware
  app.param('tribe', tribes.tribeBySlug);
};
