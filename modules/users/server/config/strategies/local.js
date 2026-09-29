/**
 * Module dependencies.
 */
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('mongoose').model('User');
const passwordHashing = require('../services/password-hashing.server.service');

module.exports = function () {
  // Use local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
      function (username, password, done) {
        User.findOne(
          {
            $or: [
              { username: username.toLowerCase() },
              { email: username.toLowerCase() },
            ],
          },
          function (err, user) {
            if (err) {
              return done(err);
            }
            if (!user) {
              return passwordHashing
                .verifyPassword(password, null, null)
                .then(() =>
                  done(null, false, {
                    message: 'Unknown user or invalid password',
                  }),
                )
                .catch(done);
            }

            return user
              .authenticate(password)
              .then(valid => {
                if (!valid) {
                  return done(null, false, {
                    message: 'Unknown user or invalid password',
                  });
                }
                return done(null, user);
              })
              .catch(done);
          },
        );
      },
    ),
  );
};
