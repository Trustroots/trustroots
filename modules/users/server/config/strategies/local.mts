import passport from 'passport';
import passportLocal from 'passport-local';
import mongoose, { type FilterQuery } from 'mongoose';
import passwordHashing from '../../services/password-hashing.server.service.mts';
import { ACCOUNT_IDENTIFIER_MAX_LENGTH } from '../../lib/account-identifier.server.mts';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../../models/user.server.types.mts';

type VerifyCallback = (
  error: Error | null,
  user?: UserServerDocument | false | null,
  info?: { message: string },
) => void;
/**
 * Module dependencies.
 */
const User = mongoose.model<UserServerRecord, UserServerModel>('User');

function rejectCredentials(
  password: unknown,
  done: VerifyCallback,
): Promise<void> {
  return passwordHashing
    .verifyPassword(typeof password === 'string' ? password : '', null, null)
    .then(() =>
      done(null, false, {
        message: 'Unknown user or invalid password',
      }),
    )
    .catch(done);
}

async function findUser(
  filter: FilterQuery<UserServerRecord>,
): Promise<UserServerDocument | null> {
  return User.findOne(filter);
}

const defaultExport = function (): void {
  // Use local strategy
  passport.use(
    new passportLocal.Strategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
      function (username: unknown, password: unknown, done: VerifyCallback) {
        if (
          typeof username !== 'string' ||
          typeof password !== 'string' ||
          username.length > ACCOUNT_IDENTIFIER_MAX_LENGTH
        ) {
          rejectCredentials(password, done);
          return;
        }

        findUser({
          $or: [
            { username: username.toLowerCase() },
            { email: username.toLowerCase() },
          ],
        }).then(
          function (user) {
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
          function (err) {
            done(err);
          },
        );
      },
    ),
  );
};

export default defaultExport;
export { defaultExport as 'module.exports' };
