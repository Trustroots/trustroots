import _ from 'lodash';
import errorService from './../../../core/server/services/error.server.service.mjs';
const service = {};

/**
 * Module dependencies.
 */

/**
 * Handle invalidating sessions of suspended users
 */
service.invalidateSuspendedSessions = function (req, res, next) {
  // User is suspended
  if (
    req.user &&
    _.isArray(req.user.roles) &&
    req.user.roles.indexOf('suspended') > -1
  ) {
    // Passport 0.6+ requires logout errors to be handled asynchronously.
    return req.logout(function (err) {
      if (err) {
        return next(err);
      }

      // Express session middleware way of removing the session
      // https://github.com/expressjs/session#sessiondestroycallback
      return req.session.destroy(function () {
        const suspendedMessage = errorService.getErrorMessageByKey('suspended');
        res.status(403).format({
          'text/html'() {
            res.render('suspended.server.view.html', {
              message: suspendedMessage,
            });
          },
          'application/json'() {
            res.json({
              message: suspendedMessage,
            });
          },
        });
      });
    });
  }

  // User isn't suspended, just continue
  next();
};
const defaultExport = service;
export default defaultExport;
export const invalidateSuspendedSessions =
  defaultExport.invalidateSuspendedSessions;
export { defaultExport as 'module.exports' };
