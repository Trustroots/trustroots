/**
 * Module dependencies.
 */
const _ = require('lodash');
const core = require('../controllers/core.server.controller');
const tribes = require('../../../tribes/server/controllers/tribes.server.controller');

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

  app.route('/api/languages').get(core.getLanguages);

  // Return a 404 for all undefined api, module or lib routes
  app.route('/:url(api|modules|lib|developers)/*').get(core.renderNotFound);

  // Define a tribes route to ensure we'll pass tribe object to index
  // Object is passed to layout at `core.renderIndex()`
  app.route('/circles/:tribe').get(core.renderIndex);

  app.route('/.well-known/nostr.json').get(function(req, res) {
    // NIP05 work in progress, https://github.com/Trustroots/trustroots/issues/2692
    const mongoose = require('mongoose');
    const User = mongoose.model('User');
    
    const name = req.query.name;
    
    User.findOne({ username: name }, function(err, user) {
      if (err) {
        res.status(500).send({ error: 'Internal server error' });
      } else if (!user) {
        res.status(404).send({ error: 'User not found' });
      } else {
        const nostrNpub = user.nostrNpub || 'User does not have a Nostr public key';
    //    const npubs = {
    //      "nostroots": "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e",
    //      "thefriendlyhost": "84d17317d46629037291f93df470c28082a874305e41c9465970659e9254edab"
    //    };
        res.json({
          "names": {
            [name]: nostrNpub  // TODO convert npub to hex
          }
        });
    
      }
    });

  });

  // Define application route
  app.route('/*').get(core.renderIndex);

  // Finish by binding the tribes middleware
  app.param('tribe', tribes.tribeBySlug);
};
