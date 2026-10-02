import { createRequire } from 'node:module';
import passport from 'passport';
import mongoose from 'mongoose';
import path from 'path';
import config from '../../../../config/config.js';
import usersSuspended from '../controllers/users.suspended.server.controller.js';

const require = createRequire(import.meta.url);
/**
 * Module dependencies.
 */

const User = mongoose.model('User');

const defaultExport = function (app) {
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
  config.utils
    .getGlobbedPaths(path.join(import.meta.dirname, './strategies/**/*.js'))
    .forEach(function (strategy) {
      // Passport setup requires these CommonJS strategies to register synchronously.
      // eslint-disable-next-line import/no-dynamic-require
      require(path.resolve(strategy))(config);
    });

  // Add passport's middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Handle logging out suspended users
  app.use(usersSuspended.invalidateSuspendedSessions);
};
export default defaultExport;
