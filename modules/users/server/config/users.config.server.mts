import { pathToFileURL } from 'node:url';
import passport from 'passport';
import mongoose from 'mongoose';
import path from 'path';
import config from './../../../../config/config.mts';
import usersSuspended from './../controllers/users.suspended.server.controller.mts';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
/**
 * Module dependencies.
 */

interface SessionCandidate {
  id?: unknown;
  authVersion?: unknown;
}
interface UsersApplication {
  use(...handlers: ((...arguments_: never[]) => unknown)[]): unknown;
}

const User = mongoose.model<UserServerRecord, UserServerModel>('User');

async function findSessionUser(id: string): Promise<UserServerDocument | null> {
  const findOne = User.findOne as unknown as (
    query: { _id: string },
    projection: string,
  ) => PromiseLike<UserServerDocument | null>;
  return await findOne.call(User, { _id: id }, '-salt -password');
}

const defaultExport = async function (app: UsersApplication): Promise<void> {
  // Serialize sessions
  passport.serializeUser<UserServerDocument>(function (user, done) {
    done(null, {
      id: user.id,
      authVersion: user.authVersion || 0,
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

      findSessionUser(sessionData!.id as string).then(
        function (user) {
          if (!user) {
            return done(null, user);
          }
          if ((user.authVersion || 0) !== sessionData!.authVersion) {
            return done(null, false);
          }
          return done(null, user);
        },
        function (err) {
          done(err, false);
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
};
export default defaultExport;
export { defaultExport as 'module.exports' };
