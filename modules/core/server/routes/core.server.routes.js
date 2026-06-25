/**
 * Module dependencies.
 */
const _ = require('lodash');
const core = require('../controllers/core.server.controller');
const tribes = require('../../../tribes/server/controllers/tribes.server.controller');
const authenticationService = require('../../../users/server/services/authentication.server.service');
const nip19 = require('nostr-tools/nip19');

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

  app.route('/.well-known/nostr.json').get(function (req, res) {
    // NIP05 work in progress, https://github.com/Trustroots/trustroots/issues/2692
    const mongoose = require('mongoose');
    const User = mongoose.model('User');

    res.set('Access-Control-Allow-Origin', '*');

    const rawName = req.query.name;

    if (!authenticationService.isLegacyUsernameLookupValid(rawName)) {
      return res.status(400).send({ error: 'Valid username required.' });
    }

    const name = rawName.toLowerCase();

    User.findOne(
      {
        username: name,
        public: true,
        email: { $exists: true, $nin: ['', null] },
        roles: { $nin: ['suspended', 'shadowban'] },
      },
      function (err, user) {
        if (err) {
          res.status(500).send({ error: 'Internal server error' });
          return;
        }

        const obj = {
          names: {},
        };

        if (!user) {
          res.json(obj);
          return;
        }

        const nostrNpub = user.nostrNpub;

        try {
          if (nostrNpub) {
            const result = nip19.decode(nostrNpub);
            if (result.type === 'npub' && /^[0-9a-f]{64}$/i.test(result.data)) {
              obj.names[name] = result.data.toLowerCase();
            }
          }
        } catch (err) {
          // Malformed stored Nostr keys should fail closed.
          _.noop(err);
        }

        res.json(obj);
      },
    );
  });

  // Define application route
  app.route('/*').get(core.renderIndex);

  // Finish by binding the tribes middleware
  app.param('tribe', tribes.tribeBySlug);
};
