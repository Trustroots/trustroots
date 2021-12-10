/**
 * Module dependencies.
 */
const passport = require('passport');
const User = require('mongoose').model('User');
const path = require('path');
const config = require(path.resolve('./config/config'));
const usersSuspended = require(path.resolve(
  './modules/users/server/controllers/users.suspended.server.controller',
));

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
  app.use(passport.session());

  // Handle logging out suspended users
  app.use(usersSuspended.invalidateSuspendedSessions);
};
