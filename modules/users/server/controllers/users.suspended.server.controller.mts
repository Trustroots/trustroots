import _ from 'lodash';
import errorService from './../../../core/server/services/error.server.service.mts';

interface SuspendedRequest {
  user?: { roles?: unknown };
  logout?: (callback: (error?: Error | null) => void) => void;
  session?: { destroy?: (callback: () => void) => void };
}

interface SuspendedResponse {
  format?(formatters: Record<string, () => void>): unknown;
  redirect?(url: string): unknown;
  status?(code: number): { json(body: { message: string }): unknown };
}

interface SuspendedController {
  invalidateSuspendedSessions(
    req: SuspendedRequest,
    res: SuspendedResponse,
    next: (error?: Error) => void,
  ): unknown;
}

const service = {} as SuspendedController;

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
    return req.logout!(function (err) {
      if (err) {
        return next(err);
      }

      // Express session middleware way of removing the session
      // https://github.com/expressjs/session#sessiondestroycallback
      return req.session!.destroy!(function () {
        res.format!({
          'text/html'() {
            res.redirect!('/suspended');
          },
          'application/json'() {
            res.status!(403).json({
              message: errorService.getErrorMessageByKey('suspended'),
            });
          },
        });
      });
    });
  }

  // User isn't suspended, just continue
  next();
};
export default service;
/** @esmNamed */
export const invalidateSuspendedSessions = service.invalidateSuspendedSessions;
