import { pathToFileURL } from 'node:url';
import passport from 'passport';
import mongoose, { type FilterQuery } from 'mongoose';
import path from 'path';
import config from './../../../../config/config.mts';
import usersSuspended from './../controllers/users.suspended.server.controller.mts';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
import { checkMemberSession } from '../services/member-session.server.service.mjs';
import requireMfaForAccountAccess from './../middleware/mfa-session.server.middleware.mjs';
/**
 * Module dependencies.
 */

interface SessionCandidate {
  id?: unknown;
  authVersion?: unknown;
  mfaVerified?: unknown;
}
interface UsersApplication {
  use(...handlers: ((...arguments_: never[]) => unknown)[]): unknown;
}

const User = mongoose.model<UserServerRecord, UserServerModel>('User');

function findSessionUser(
  id: FilterQuery<UserServerRecord>['_id'],
  callback: (error: Error | null, user: UserServerDocument | null) => void,
): void {
  Reflect.apply(User.findOne, User, [{ _id: id }, '-salt -password', callback]);
}

const defaultExport = async function (app: UsersApplication): Promise<void> {
  // Serialize sessions
  passport.serializeUser<
    { session: { memberSessionCreatedAt?: number } },
    UserServerDocument
  >(function (req, user, done) {
    req.session.memberSessionCreatedAt = Date.now();
    done(null, {
      id: user.id,
      authVersion: user.authVersion || 0,
      mfaVerified:
        user.$locals?.mfaVerified === true && user.mfaEnabled === true,
    });
  });

  // Deserialize sessions
  passport.deserializeUser<unknown, UserServerDocument>(
    function (session, done) {
      const sessionData = session as SessionCandidate | null | undefined;
      if (
        !session ||
        typeof session !== 'object' ||
        !sessionData!.id ||
        !Number.isInteger(sessionData!.authVersion)
      ) {
        return done(null, false);
      }

      findSessionUser(
        sessionData!.id as FilterQuery<UserServerRecord>['_id'],
        function (err, user) {
          if (err || !user) {
            return done(err, user);
          }
          if ((user.authVersion || 0) !== sessionData!.authVersion) {
            return done(null, false);
          }
          user.$locals = user.$locals || {};
          user.$locals.mfaVerified =
            user.mfaEnabled === true && sessionData!.mfaVerified === true;
          return done(null, user);
        },
      );
    },
  );

  // Initialize strategies
  for (const strategy of config.utils.getGlobbedPaths(
    path.join(import.meta.dirname, './strategies/**/*.mts'),
  )) {
    const { default: configure } = await import(
      pathToFileURL(path.resolve(strategy)).href
    );
    configure(config);
  }

  // Add passport's middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Handle logging out suspended users
  app.use(usersSuspended.invalidateSuspendedSessions);
  app.use(checkMemberSession);
  app.use(requireMfaForAccountAccess);
};
export default defaultExport;
export { defaultExport as 'module.exports' };
