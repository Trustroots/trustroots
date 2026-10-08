import passport from 'passport';
import passportLocal from 'passport-local';
import mongoose from 'mongoose';
import passwordHashing from '../../services/password-hashing.server.service.mjs';
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
        if (
          typeof username !== 'string' ||
          typeof password !== 'string' ||
          username.length > 320
        ) {
          return done(null, false, {
            message: 'Unknown user or invalid password',
          });
        }

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
export default defaultExport;
export { defaultExport as 'module.exports' };
