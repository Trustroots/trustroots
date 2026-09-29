/**
 * Module dependencies.
 */
const passport = require('passport');
const User = require('mongoose').model('User');
const path = require('path');
const config = require('../../../../config/config');
const usersSuspended = require('../controllers/users.suspended.server.controller');

module.exports = function (app) {
  // Serialize sessions
  passport.serializeUser(function (user, done) {
    done(null, {
      id: user.id,
      authVersion: user.authVersion || 0,
    });
  });

  // Deserialize sessions
  passport.deserializeUser(function (session, done) {
    // Sessions written before authVersion was introduced contain only the ID.
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
    .getGlobbedPaths(path.join(__dirname, './strategies/**/*.js'))
    .forEach(function (strategy) {
      require(path.resolve(strategy))(config);
    });

  // Add passport's middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Handle logging out suspended users
  app.use(usersSuspended.invalidateSuspendedSessions);
};
