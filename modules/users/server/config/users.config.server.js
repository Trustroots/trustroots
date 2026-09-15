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
    .getGlobbedPaths(path.join(__dirname, './strategies/**/*.js'))
    .forEach(function (strategy) {
      require(path.resolve(strategy))(config);
    });

  // Add passport's middleware
  app.use(passport.initialize());
  const browserPassportSession = passport.session();
  app.use(function browserPassportSessionOnly(req, res, next) {
    if (/^\/api\/mobile\/v0(?:\/|$)/.test(req.path)) {
      return next();
    }
    return browserPassportSession(req, res, next);
  });

  // Handle logging out suspended users
  app.use(usersSuspended.invalidateSuspendedSessions);
};
