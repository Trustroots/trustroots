'use strict';

var path = require('path'),
    errorService = require('../services/error.server.service'),
    userProfile = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    config = require(path.resolve('./config/config')),
    log = require(path.resolve('./config/lib/logger')),
    debug = require('debug')('tr:core:controller');

/**
 * Render the main application page
 */
exports.renderIndex = function(req, res) {
  debug('Render index page');

  var renderVars = {
    user: null
  };

  // Expose user
  if (req.user) {
    debug('Render index page: user found');
    renderVars.user = userProfile.sanitizeProfile(req.user, req.user);
  }

  // Expose tribe (when browsing `/tribes/tribe-name`)
  if (req.tribe) {
    debug('Render index page: tribe found');
    renderVars.tribe = req.tribe;
  }

  // Show different `og:` tags for signup pages
  // https://expressjs.com/en/api.html#req.path
  if (req.path === '/signup') {
    debug('Render index page: signup path regogniced');
    renderVars.invite = true;
  }

  res.render('modules/core/server/views/index', renderVars);
};

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
exports.renderNotFound = function(req, res) {
  debug('Render not found page');

  res.status(404).format({
    'text/html': function() {
      res.render('modules/core/server/views/404');
    },
    'application/json': function() {
      res.json({ message: errorService.getErrorMessageByKey('not-found') });
    },
    'default': function() {
      res.send(errorService.getErrorMessageByKey('not-found'));
    }
  });
};

/**
 * Log received CSP violation report
 * See `config/lib/express.js` and `initHelmetHeaders()` for more
 */
exports.receiveCSPViolationReport = function(req, res) {
  debug('Received CSP violation report');

  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'CSP violation report #ljeanw', {
      report: req.body ? textProcessor.html(req.body) : 'No report available.'
    });
  }
  res.status(204).json();
};

/**
 * Log received CT report
 * See `config/lib/express.js` and `initHelmetHeaders()` for more
 * @link https://helmetjs.github.io/docs/expect-ct/
 * @link https://scotthelme.co.uk/a-new-security-header-expect-ct/
 */
exports.receiveExpectCTViolationReport = function(req, res) {
  debug('Received Expect-CT violation report');
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'Expect-CT violation report #3hg8ha', {
      report: req.body ? textProcessor.html(req.body) : 'No report available.'
    });
  }
  res.status(204).json();
};

/**
* Render javascript content containing service worker config.
*/
exports.renderServiceWorkerConfig = function(req, res) {
  debug('Render service worker config');
  res.set('Content-Type', 'text/javascript')
    .send('var FCM_SENDER_ID = ' + JSON.stringify(config.fcm.senderId) + ';\n');
};
