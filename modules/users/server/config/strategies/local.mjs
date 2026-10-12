import passport from 'passport';
import passportLocal from 'passport-local';
import mongoose from 'mongoose';
import passwordHashing from '../../services/password-hashing.server.service.mjs';
import { ACCOUNT_IDENTIFIER_MAX_LENGTH } from '../../lib/account-identifier.server.mjs';
/**
 * Module dependencies.
 */
const LocalStrategy = passportLocal.Strategy;
const User = mongoose.model('User');

const rejectCredentials = (password, done) =>
  passwordHashing
    .verifyPassword(typeof password === 'string' ? password : '', null, null)
    .then(() =>
      done(null, false, {
        message: 'Unknown user or invalid password',
      }),
    )
    .catch(done);

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
          username.length > ACCOUNT_IDENTIFIER_MAX_LENGTH
        ) {
          return rejectCredentials(password, done);
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
              return rejectCredentials(password, done);
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
