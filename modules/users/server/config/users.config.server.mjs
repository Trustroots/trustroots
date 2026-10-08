import { pathToFileURL } from 'node:url';
import passport from 'passport';
import mongoose from 'mongoose';
import path from 'path';
import config from './../../../../config/config.mjs';
import usersSuspended from './../controllers/users.suspended.server.controller.mjs';
import requireMfaForAccountAccess from './../middleware/mfa-session.server.middleware.mjs';
/**
 * Module dependencies.
 */

const User = mongoose.model('User');
const defaultExport = async function (app) {
  // Serialize sessions
  passport.serializeUser(function (user, done) {
    done(null, {
      id: user.id,
      authVersion: user.authVersion || 0,
      mfaVerified:
        user.$locals?.mfaVerified === true && user.mfaEnabled === true,
    });
  });

  // Deserialize sessions
  passport.deserializeUser(function (session, done) {
    if (
      !session ||
      typeof session !== 'object' ||
      !session.id ||
      !Number.isInteger(session.authVersion)
    ) {
      return done(null, false);
    }

    User.findOne(
      {
        _id: session.id,
      },
      '-salt -password',
      function (err, user) {
        if (err || !user) {
          return done(err, user);
        }
        if ((user.authVersion || 0) !== session.authVersion) {
          return done(null, false);
        }
        // MFA verification is a session fact. Never infer it from the account
        // record or from a password/email recovery login path.
        user.$locals.mfaVerified =
          user.mfaEnabled === true && session.mfaVerified === true;
        return done(null, user);
      },
    );
  });

  // Initialize strategies
  for (const strategy of config.utils.getGlobbedPaths(
    path.join(import.meta.dirname, './strategies/**/*.mjs'),
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
  app.use(requireMfaForAccountAccess);
};
export default defaultExport;
export { defaultExport as 'module.exports' };
