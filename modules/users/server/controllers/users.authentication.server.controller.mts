import _ from 'lodash';
import errorService from '../../../core/server/services/error.server.service.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import userProfile from './users.profile.server.controller.mjs';
import authenticationService from '../services/authentication.server.service.mts';
import signupSafety from '../services/signup-safety.server.service.mts';
import statService from '../../../stats/server/services/stats.server.service.mts';
import log from '../../../../config/lib/logger.mjs';
import passport from 'passport';
import async from 'async';
import crypto from 'crypto';
import mongoose, { type QueryFilter, type UpdateQuery } from 'mongoose';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
import {
  emailConfirmationTokenQuery,
  setEmailConfirmationToken,
} from '../services/email-confirmation.server.service.mts';
type UserDocument = UserServerDocument;
type AuthenticatedUser = UserDocument;

interface AuthRequest {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  user?: AuthenticatedUser;
  login?(user: UserDocument, callback: (error?: Error | null) => void): void;
  logout?(callback: (error?: Error | null) => void): void;
}

interface AuthResponse {
  status(code: number): AuthResponse;
  send(body: unknown): unknown;
  json(body: unknown): unknown;
  redirect(path: string): unknown;
  set?(field: string, value: string): AuthResponse;
  vary?(field: string): AuthResponse;
}

interface AuthNext {
  (error?: Error): void;
}

interface AccountError extends Error {
  code?: string;
  status?: number;
  userFacing?: boolean;
}

type WaterfallCallback = (error?: Error | null, ...results: unknown[]) => void;

interface SignupRequiredFields extends Record<string, unknown> {
  firstName: string;
  lastName?: string;
  username: string;
  password: string;
  email: string;
}

function hasSignupRequiredFields(
  body: Record<string, unknown> | undefined,
): body is SignupRequiredFields {
  return (
    !!body &&
    ['firstName', 'username', 'password', 'email'].every(
      field => typeof body[field] === 'string' && body[field],
    ) &&
    (body.lastName === undefined || typeof body.lastName === 'string')
  );
}

interface StatsPayload {
  namespace: string;
  counts: { count: number };
  tags: Record<string, string>;
}

interface EmailConfirmationResult {
  profileMadePublic: boolean;
  user?: import('./users.profile.server.contracts.mts').ProfilePayload;
}

interface AuthenticationController {
  signup(req: AuthRequest, res: AuthResponse): void;
  signupValidation(req: AuthRequest, res: AuthResponse): void;
  signin(req: AuthRequest, res: AuthResponse, next: AuthNext): void;
  session(req: AuthRequest, res: AuthResponse): void;
  signout(req: AuthRequest, res: AuthResponse, next: AuthNext): void;
  removeOAuthProvider(req: AuthRequest, res: AuthResponse): void;
  validateEmailToken(req: AuthRequest, res: AuthResponse): void;
  confirmEmail(req: AuthRequest, res: AuthResponse): void;
  resendConfirmation(req: AuthRequest, res: AuthResponse): void;
}

const service = {} as AuthenticationController;
/**
 * Module dependencies.
 */
const User = mongoose.model<UserServerRecord, UserServerModel>('User');

function findOneAndUpdateWithCallback(
  filter: QueryFilter<UserServerRecord>,
  update: UpdateQuery<UserServerRecord>,
  options: { new: boolean },
  callback: (error: Error | null, user: UserDocument | null) => void,
): void {
  User.findOneAndUpdate(filter, update, options).then(
    user => callback(null, user),
    (error: Error) => callback(error, null),
  );
}

function isNameSpam(input: string): boolean {
  if (
    // The username field says it limits to 34, so apply that to all the fields
    input.length > 34 ||
    input.includes(':') ||
    input.includes('/') ||
    input.includes('_') ||
    input.includes('www') ||
    input.includes('bit.ly')
  ) {
    return true;
  }
  return false;
}

/**
 * Signup
 */
service.signup = function (req, res) {
  let validatedSignupBody: SignupRequiredFields | undefined;
  let signupUser: UserDocument | undefined;
  async.waterfall(
    [
      // Check if we have the required data before hitting more strict validations at Mongo
      function (done: WaterfallCallback) {
        if (!hasSignupRequiredFields(req.body)) {
          const err: AccountError = new Error(
            'Please provide required fields.',
          );
          err.userFacing = true;
          return done(err);
        }
        validatedSignupBody = req.body;

        if (
          ['locale', 'acquisitionStory'].some(
            field =>
              validatedSignupBody?.[field] !== undefined &&
              typeof validatedSignupBody[field] !== 'string',
          ) ||
          (validatedSignupBody?.newsletter !== undefined &&
            typeof validatedSignupBody.newsletter !== 'boolean')
        ) {
          const err: AccountError = new Error(
            'Please provide valid signup preferences.',
          );
          err.userFacing = true;
          return done(err);
        }

        if (req.body.ageConfirmed !== true) {
          const err: AccountError = new Error(
            'You must confirm that you are 18 years old or older to sign up.',
          );
          err.userFacing = true;
          return done(err);
        }

        done();
      },

      // Simple anti spam check on name input fields
      function (done: WaterfallCallback) {
        const body = validatedSignupBody!;
        const { firstName, lastName, username } = body;
        if (isNameSpam(firstName) || (lastName && isNameSpam(lastName))) {
          return done(new Error('Invalid signup attempt'));
        }

        if (!authenticationService.validateUsername(username)) {
          const err: AccountError = new Error(
            authenticationService.isUsernameFormatValid(username)
              ? 'Username is not available.'
              : authenticationService.usernameFormatMessage,
          );
          err.userFacing = true;
          return done(err);
        }

        done();
      },

      // Generate random token
      function (done: WaterfallCallback) {
        crypto.randomBytes(20, function (err, buffer) {
          const salt = buffer;
          done(err, salt);
        });
      },

      // Save user
      function (salt: Buffer, done: WaterfallCallback) {
        const body = validatedSignupBody!;
        const user = new User(
          _.pick(body, [
            'firstName',
            'lastName',
            'username',
            'password',
            'email',
            'newsletter',
            'locale',
            'acquisitionStory',
          ]),
        );

        // Add missing user fields
        user.public = false;
        user.provider = 'local';
        user.displayName = [user.firstName, user.lastName]
          .filter((name): name is string => Boolean(name?.trim()))
          .map(name => name.trim())
          .join(' ');

        // Just to simplify email confirm process later
        // This field is normally needed when changing email after the signup process
        // Since we set user public=false and require initial email confirmation,
        // we'll have to have the email also at emailTemporary field
        // (from where it's then again moved to email field)
        user.emailTemporary = user.email;
        signupUser = user;

        setEmailConfirmationToken(
          user,
          authenticationService.generateEmailToken(user, salt),
        );

        // Then save the user
        user.save().then(
          function () {
            // Remove sensitive data before login
            user.password = undefined;
            user.salt = undefined;

            done(null, user);
          },
          function (err: Error) {
            user.password = undefined;
            user.salt = undefined;
            done(err);
          },
        );
      },

      // Send email
      function (_user: unknown, done: WaterfallCallback) {
        const createdUser = signupUser!;
        const matchedKeywords = signupSafety.matchSignupProfile(createdUser);
        if (matchedKeywords.length) {
          emailService.sendFlaggedSignupAlert(
            createdUser,
            matchedKeywords,
            function (err?: Error | null) {
              if (err) {
                log('error', 'Flagged signup alert delivery failed.', {
                  error: err,
                });
              }
            },
          );
        }

        emailService.sendSignupEmailConfirmation(
          createdUser,
          function (err?: Error | null) {
            done(err, createdUser);
          },
        );
      },

      // Login
      function (_user: unknown, done: WaterfallCallback) {
        const createdUser = signupUser!;
        req.login!(createdUser, function (err) {
          // Remove sensitive data befor sending user
          const sanitizedUser = userProfile.sanitizeOwnProfile(createdUser);

          done(err, sanitizedUser);
        });
      },
    ],
    function (err: Error | null | undefined, ...results: unknown[]) {
      const statsObject: StatsPayload = {
        namespace: 'signup',
        counts: {
          count: 1,
        },
        tags: {},
      };

      // Signup process failed
      if (err) {
        // Log the failure to signup
        log('error', 'User signup failed. #fywghg', {
          error: err,
        });

        // Send signup failure to stats servers
        statsObject.tags.status = 'failed';
        const accountError: AccountError = err;
        statService.stat(statsObject, function () {
          // Send error to the API
          res.status(accountError.code === 'KDF_OVERLOADED' ? 503 : 400).send({
            message: accountError.userFacing
              ? accountError.message
              : errorService.getErrorMessage(err),
          });
        });

        return;
      }

      // Signup process was successful

      // Send signup success to stats servers
      statsObject.tags.status = 'success';
      statService.stat(statsObject, function () {
        res.json(results[0] || {});
      });
    },
  );
};

/**
 * Signup validation
 */
service.signupValidation = function (req, res) {
  const suppliedUsername = req.body!.username;
  const username =
    typeof suppliedUsername === 'string' ? suppliedUsername : undefined;
  if (suppliedUsername !== undefined && typeof suppliedUsername !== 'string') {
    return res.status(400).send({
      valid: false,
      error: 'username-invalid',
      message: authenticationService.usernameFormatMessage,
    });
  }

  async.waterfall(
    [
      // Validate username
      function (done: WaterfallCallback) {
        // Check if we have the required data before hitting more strict validations
        if (username === undefined || username === '') {
          return done(
            new Error('Please provide required `username` field.'),
            'username-missing',
          );
        }

        if (!authenticationService.isUsernameFormatValid(username)) {
          return done(
            new Error(authenticationService.usernameFormatMessage),
            'username-invalid',
          );
        }

        // Is username reserved?
        // You can modify the list from `config/env/default.js`
        if (authenticationService.isUsernameReserved(username)) {
          return done(
            new Error('Username is not available.'),
            'username-not-available-reserved',
          );
        }

        done();
      },

      // Check username availability against database
      function (done: WaterfallCallback) {
        User.findOne({
          username: username!.toLowerCase(),
        }).then(
          (user: UserDocument | null) => {
            if (user) {
              return done(
                new Error('Username is not available.'),
                'username-not-available',
              );
            }

            done();
          },
          () => done(),
        );
      },
    ],
    function (err: Error | null | undefined, errorCode: unknown) {
      const statsObject: StatsPayload = {
        namespace: 'signup-validation',
        counts: {
          count: 1,
        },
        tags: {},
      };

      // Signup validation failed
      if (err) {
        // Send signup validation failure to stats servers
        statsObject.tags.status = 'failed';
        statsObject.tags.reason =
          typeof errorCode === 'string' ? errorCode : 'other';
        statService.stat(statsObject, function () {
          // Send error to the API
          // HTTP status "200 OK"
          res.status(200).send({
            valid: false,
            error: errorCode || 'other',
            message: err.message || errorService.getErrorMessage(err),
          });
        });

        return;
      }

      // Signup validation was successful

      // Send signup validation success to stats servers
      statsObject.tags.status = 'success';
      statService.stat(statsObject, function () {
        res.status(200).send({
          valid: true,
        });
      });
    },
  );
};

/**
 * Signin after passport authentication
 */
service.signin = function (req, res, next) {
  const statsObject: StatsPayload = {
    namespace: 'signin',
    counts: {
      count: 1,
    },
    tags: {},
  };

  passport.authenticate<UserDocument>('local', function (err, user, info) {
    if (err && 'code' in err && err.code === 'KDF_OVERLOADED') {
      return res.status(503).send({
        message: 'Password service is temporarily busy. Please try again.',
      });
    }

    if (err || !user) {
      // Log the failure to signin
      log('error', 'User signin failed. #3tfgbg-1', {
        reason: 'Wrong credentials',
        error: err || null,
      });

      // Send signin failure to stats servers
      statsObject.tags.status = 'failed:wrong-credentials';
      statService.stat(statsObject, function () {});
      res.status(400).send(info);
      return;
    }

    // Don't let suspended users sign in
    if (user.roles.includes('suspended')) {
      // Log the failure to signin
      log('error', 'User signin failed. #3tfgbg-2', {
        reason: 'Suspended user',
      });

      // Send signin failure to stats servers
      statsObject.tags.status = 'failed:suspended';
      statService.stat(statsObject, function () {});
      res.status(403).send({
        message: errorService.getErrorMessageByKey('suspended'),
      });

      return;
    }

    req.login!(user, function (err) {
      if (err) {
        // Log the failure to signin
        log('error', 'User signin failed. #3tfgbg-3', {
          reason: 'Login error',
          error: err,
        });

        // Send signin failure to stats servers
        statsObject.tags.status = 'failed:other';
        statService.stat(statsObject, function () {});
        res.status(400).send(err);
        return;
      }

      // Send signin success to stats servers
      statsObject.tags.status = 'success';
      // Statistics delivery must not hold up authentication during an outage.
      statService.stat(statsObject, function () {});
      res.json(userProfile.sanitizeOwnProfile(user));
    });
  })(req, res, next);
};

/**
 * Confirm the account recognised on a subsequent browser request.
 */
service.session = function (req, res) {
  res.set!('Cache-Control', 'no-store');
  res.vary!('Cookie');
  res.json({ userId: req.user ? String(req.user._id) : null });
};

/**
 * Signout
 */
service.signout = function (req, res, next) {
  req.logout!(function (err) {
    if (err) {
      return next(err);
    }
    return res.redirect('/');
  });
};

/**
 * Remove OAuth provider
 */
service.removeOAuthProvider = function (req, res) {
  // Return error if no user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Return error if no provider or wrong provider
  if (
    !req.params!.provider ||
    !_.includes(['github', 'facebook', 'twitter'], req.params!.provider)
  ) {
    return res.status(400).send({
      message: 'No provider defined.',
    });
  }

  const user = req.user;
  const provider = req.params!.provider;

  // Delete the additional provider
  if (user.additionalProvidersData![provider]) {
    delete user.additionalProvidersData![provider];

    // Then tell mongoose that we've updated the additionalProvidersData field
    user.markModified('additionalProvidersData');
  }

  user.save().then(
    function () {
      req.login!(user, function (err) {
        if (err) {
          return res.status(400).send(err);
        }

        // Remove sensitive data before sending out
        res.json(userProfile.sanitizeOwnProfile(user));
      });
    },
    function (err: Error) {
      res.status(400).send({
        message: errorService.getErrorMessage(err),
      });
    },
  );
};

/**
 * Confirm email GET from email token
 */
service.validateEmailToken = function (req, res) {
  const now = new Date();
  User.findOne(emailConfirmationTokenQuery(req.params!.token, now)).then(
    (user: UserDocument | null) => {
      if (!user) {
        return res.redirect('/confirm-email-invalid');
      }
      res.redirect('/confirm-email/' + req.params!.token);
    },
    () => res.redirect('/confirm-email-invalid'),
  );
};

/**
 * Confirm email POST from email token
 */
service.confirmEmail = function (req, res) {
  const now = new Date();
  const tokenQuery = emailConfirmationTokenQuery(req.params!.token, now);
  async.waterfall(
    [
      function (done: WaterfallCallback) {
        // Check if user exists with this token
        User.findOne(tokenQuery).then(
          user => {
            if (user) {
              // Will be the returned object when no errors
              const result: EmailConfirmationResult = {
                // If users profile was hidden, it means it was first confirmation email after registration.
                profileMadePublic: !user.public,
              };

              done(null, result, user);
            } else {
              return res.status(400).send({
                message: 'Email confirm token is invalid or has expired.',
              });
            }
          },
          () =>
            res.status(400).send({
              message: 'Email confirm token is invalid or has expired.',
            }),
        );
      },

      // Update user
      // We can't do regular `user.save()` here because we've got user document with password and we'd just override it:
      // Instead we'll do normal Mongoose update with previously fetched user ID
      function (
        result: EmailConfirmationResult,
        user: UserDocument & { emailTemporary: string },
        done: WaterfallCallback,
      ) {
        const authVersion = user.authVersion || 0;
        const authVersionQuery =
          authVersion === 0
            ? {
                $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }],
              }
            : { authVersion };
        findOneAndUpdateWithCallback(
          {
            _id: user._id,
            emailTemporary: user.emailTemporary,
            // The token query already contains an $or for legacy expiry
            // handling, so combine both conditions without overwriting it.
            $and: [tokenQuery, authVersionQuery],
          },
          {
            $unset: {
              emailTemporary: 1,
              emailToken: 1,
              emailTokenIssuedAt: 1,
              emailTokenExpires: 1,
              // Note that `publicReminderCount` and `publicReminderSent` get reset now each
              // time user confirms any email change, even if they didn't confirm their profile yet.
              // That's fine: we'll just start sending 'finish signup' notifications from scratch
              // to the new email. That old email before the change might've been wrong anyway...
              publicReminderCount: 1,
              publicReminderSent: 1,
            },
            $set: {
              public: true,
              // Welcome sequence emails are sent in time intervals
              welcomeSequenceSent: new Date(),
              // Replace old email with new one
              email: user.emailTemporary,
              // @todo: this should be done at user.server.model.js
              emailHash: crypto
                .createHash('md5')
                .update(user.emailTemporary.trim().toLowerCase())
                .digest('hex'),
            },
          },
          {
            // Return the document after updates if `new = true`
            new: true,
          },
          function (err: Error | null, modifiedUser: UserDocument | null) {
            if (!err && !modifiedUser) {
              return res.status(400).send({
                message: 'Email confirm token is invalid or has expired.',
              });
            }
            done(err, result, modifiedUser);
          },
        );
      },

      function (
        result: EmailConfirmationResult,
        user: UserDocument,
        done: WaterfallCallback,
      ) {
        req.login!(user, function (err?: Error | null) {
          done(err, result, user);
        });
      },

      function (result: EmailConfirmationResult, user: UserDocument) {
        // Return authenticated user
        // Remove sensitive data befor sending user
        result.user = userProfile.sanitizeOwnProfile(user);

        return res.json(result);
      },
    ],
    function (err: Error | null | undefined) {
      /* istanbul ignore else */
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Resend email confirmation token
 */
service.resendConfirmation = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  /*
    There are two valid cases for getting the confirmation resent:
      1) user is unconfirmed
      2) user is changing email address
    In both cases they will have emailTemporary set
  */
  if (!req.user.emailTemporary) {
    return res.status(400).send({
      message: 'Already confirmed.',
    });
  }

  const isEmailChange = !!req.user.public;

  async.waterfall(
    [
      // Generate random token
      function (done: WaterfallCallback) {
        crypto.randomBytes(20, function (err, buffer) {
          if (err) return done(err);
          done(null, buffer);
        });
      },

      // Save token
      function (salt: Buffer, done: WaterfallCallback) {
        const user = req.user!;
        user.set('updated', Date.now());
        setEmailConfirmationToken(
          user,
          authenticationService.generateEmailToken(user, salt),
        );
        user
          .save()
          .then(function () {
            done(null, user);
          })
          .catch(done);
      },

      // Send email
      function (user: UserDocument, done: WaterfallCallback) {
        if (isEmailChange) {
          emailService.sendChangeEmailConfirmation(
            user,
            function (err?: Error | null) {
              done(err, user);
            },
          );
        } else {
          // signup confirmation
          emailService.sendSignupEmailConfirmation(
            user,
            function (err?: Error | null) {
              done(err, user);
            },
          );
        }
      },

      // Return confirmation
      function () {
        return res.json({ message: 'Sent confirmation email.' });
      },
    ],
    function (err) {
      /* istanbul ignore else */
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

const defaultExport = service;
export const signup = service.signup;
export const signupValidation = service.signupValidation;
export const signin = service.signin;
export const signout = service.signout;
export const removeOAuthProvider = service.removeOAuthProvider;
export const validateEmailToken = service.validateEmailToken;
export const confirmEmail = service.confirmEmail;
export const resendConfirmation = service.resendConfirmation;
export const session = service.session;
export default defaultExport;
export { defaultExport as 'module.exports' };
