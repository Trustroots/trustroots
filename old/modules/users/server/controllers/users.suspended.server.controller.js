/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

/**
 * Handle invalidating sessions of suspended users
 */
exports.invalidateSuspendedSessions = function (req, res, next) {
  // User is suspended
  if (
    req.user &&
    _.isArray(req.user.roles) &&
    req.user.roles.indexOf('suspended') > -1
  ) {
    // Passport method for logging out user
    req.logout();

    // Express session middleware way of removing the session
    // https://github.com/expressjs/session#sessiondestroycallback
    return req.session.destroy(function () {
      // A short one-liner
      const suspendedMessage = errorService.getErrorMessageByKey('suspended');

      // Do content negotiation and return a message
      // https://expressjs.com/en/api.html#res.format
      res.status(403).format({
        // For HTML calls send "suspended" html view
        'text/html'() {
          res.render('suspended.server.view.html', {
            message: suspendedMessage,
          });
        },
        // For API calls send "suspended" json message
        'application/json'() {
          res.json({
            message: suspendedMessage,
          });
        },
      });
    });
  }

  // User isn't suspended, just continue
  next();
};
