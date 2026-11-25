import errorService from './../../../core/server/services/error.server.service.mts';

interface SuspendedRequest {
  path: string;
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
    Array.isArray(req.user.roles) &&
    req.user.roles.includes('suspended')
  ) {
    // Passport 0.6+ requires logout errors to be handled asynchronously.
    return req.logout!(function (err) {
      if (err) {
        return next(err);
      }

      // Express session middleware way of removing the session
      // https://github.com/expressjs/session#sessiondestroycallback
      return req.session!.destroy!(function () {
        const sendSuspendedJson = () =>
          res.status!(403).json({
            message: errorService.getErrorMessageByKey('suspended'),
          });

        if (/^\/api(?:\/|$)/i.test(req.path)) {
          return sendSuspendedJson();
        }

        res.format!({
          'text/html'() {
            res.redirect!('/suspended');
          },
          'application/json': sendSuspendedJson,
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
