const path = require('path');
const errorService = require('../services/error.server.service');
const userProfile = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));

/**
 * Render the main application page
 */
exports.renderIndex = function (req, res) {
  const renderVars = {
    user: null,
  };

  // Expose user
  if (req.user) {
    renderVars.user = userProfile.sanitizeProfile(req.user, req.user);
  }

  // Expose tribe (when browsing `/tribes/tribe-name`)
  if (req.tribe) {
    renderVars.tribe = req.tribe;
  }

  // Show different `og:` tags for signup pages
  // https://expressjs.com/en/api.html#req.path
  if (req.path === '/signup') {
    renderVars.invite = true;
  }

  res.render('index.server.view.html', renderVars);
};

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
exports.renderNotFound = function (req, res) {
  res.status(404).format({
    'text/html'() {
      res.render('404.server.view.html');
    },
    'application/json'() {
      res.json({ message: errorService.getErrorMessageByKey('not-found') });
    },
    default() {
      res.send(errorService.getErrorMessageByKey('not-found'));
    },
  });
};

/**
 * Log received CSP violation report
 * See `config/lib/express.js` and `initHelmetHeaders()` for more
 */
exports.receiveCSPViolationReport = function (req, res) {
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'CSP violation report #ljeanw', {
      report: req.body
        ? textService.plainText(JSON.stringify(req.body))
        : 'No report available.',
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
exports.receiveExpectCTViolationReport = function (req, res) {
  if (process.env.NODE_ENV !== 'test') {
    log('warn', 'Expect-CT violation report #3hg8ha', {
      report: req.body
        ? textService.plainText(JSON.stringify(req.body))
        : 'No report available.',
    });
  }
  res.status(204).json();
};

/**
 * Render javascript content containing service worker config.
 */
exports.renderServiceWorkerConfig = function (req, res) {
  res
    .set('Content-Type', 'text/javascript')
    .send('var FCM_SENDER_ID = ' + JSON.stringify(config.fcm.senderId) + ';\n');
};
