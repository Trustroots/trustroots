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
    done(null, user.id);
  });

  // Deserialize sessions
  passport.deserializeUser(function (id, done) {
    User.findOne(
      {
        _id: id,
      },
      '-salt -password',
      function (err, user) {
        done(err, user);
      },
    );
  });

  // Initialize strategies
  config.utils
    .getGlobbedPaths(path.join(import.meta.dirname, './strategies/**/*.js'))
    .forEach(function (strategy) {
      require(path.resolve(strategy))(config);
    });

  // Add passport's middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Handle logging out suspended users
  app.use(usersSuspended.invalidateSuspendedSessions);
};
export default defaultExport;
