import { pathToFileURL } from 'node:url';
import passport from 'passport';
import mongoose from 'mongoose';
import path from 'path';
import config from './../../../../config/config.mjs';
import usersSuspended from './../controllers/users.suspended.server.controller.mjs';
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
};
export default defaultExport;
export { defaultExport as 'module.exports' };
