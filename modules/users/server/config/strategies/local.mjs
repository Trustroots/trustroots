import passport from 'passport';
import passportLocal from 'passport-local';
import mongoose from 'mongoose';

/**
 * Module dependencies.
 */

const LocalStrategy = passportLocal.Strategy;
const User = mongoose.model('User');
const defaultExport = function () {
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
              {
                username: username.toLowerCase(),
              },
              {
                email: username.toLowerCase(),
              },
            ],
          },
          function (err, user) {
            if (err) {
              return done(err);
            }
            if (!user || !user.authenticate(password)) {
              return done(null, false, {
                message: 'Unknown user or invalid password',
              });
            }
            return done(null, user);
          },
        );
      },
    ),
  );
};
export default defaultExport;
export { defaultExport as 'module.exports' };
