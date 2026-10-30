import _ from 'lodash';
import errorService from '../../../core/server/services/error.server.service.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import userProfile from './users.profile.server.controller.mjs';
import authenticationService from '../services/authentication.server.service.mts';
import signupSafety from '../services/signup-safety.server.service.mts';
import statService from '../../../stats/server/services/stats.server.service.mts';
import log from '../../../../config/lib/logger.mjs';
import passport from 'passport';
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
  async function createAccount() {
    if (!hasSignupRequiredFields(req.body)) {
      const err: AccountError = new Error('Please provide required fields.');
      err.userFacing = true;
      throw err;
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
      throw err;
    }

    if (req.body.ageConfirmed !== true) {
      const err: AccountError = new Error(
        'You must confirm that you are 18 years old or older to sign up.',
      );
      err.userFacing = true;
      throw err;
    }

    {
      const body = validatedSignupBody!;
      const { firstName, lastName, username } = body;
      if (isNameSpam(firstName) || (lastName && isNameSpam(lastName))) {
        throw new Error('Invalid signup attempt');
      }

      if (!authenticationService.validateUsername(username)) {
        const err: AccountError = new Error(
          authenticationService.isUsernameFormatValid(username)
            ? 'Username is not available.'
            : authenticationService.usernameFormatMessage,
        );
        err.userFacing = true;
        throw err;
      }
    }
    const salt = await new Promise<Buffer>((resolve, reject) => {
      crypto.randomBytes(20, (err, buffer) =>
        err ? reject(err) : resolve(buffer),
      );
    });
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

    try {
      await user.save();
    } finally {
      user.password = undefined;
      user.salt = undefined;
    }
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

    await new Promise<void>((resolve, reject) => {
      emailService.sendSignupEmailConfirmation(createdUser, err =>
        err ? reject(err) : resolve(),
      );
    });
    await new Promise<void>((resolve, reject) => {
      req.login!(createdUser, err => (err ? reject(err) : resolve()));
    });
    return userProfile.sanitizeOwnProfile(createdUser);
  }
  function finished(err: Error | null | undefined, result?: unknown) {
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
      res.json(result);
    });
  }
  createAccount().then(
    result => finished(null, result),
    err => finished(err),
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

  function finished(err?: Error | null, errorCode?: string) {
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
      statsObject.tags.reason = errorCode!;
      statService.stat(statsObject, function () {
        // Send error to the API
        // HTTP status "200 OK"
        res.status(200).send({
          valid: false,
          error: errorCode,
          message: err.message,
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
  }
  if (username === undefined || username === '') {
    return finished(
      new Error('Please provide required `username` field.'),
      'username-missing',
    );
  }
  if (!authenticationService.isUsernameFormatValid(username)) {
    return finished(
      new Error(authenticationService.usernameFormatMessage),
      'username-invalid',
    );
  }
  if (authenticationService.isUsernameReserved(username)) {
    return finished(
      new Error('Username is not available.'),
      'username-not-available-reserved',
    );
  }
  User.findOne({ username: username.toLowerCase() }).then(
    user =>
      user
        ? finished(
            new Error('Username is not available.'),
            'username-not-available',
          )
        : finished(),
    () => finished(),
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
  async function confirm() {
    const user = await User.findOne(tokenQuery).catch(() => null);
    if (!user) {
      res
        .status(400)
        .send({ message: 'Email confirm token is invalid or has expired.' });
      return;
    }
    const result: EmailConfirmationResult = { profileMadePublic: !user.public };
    const authVersion = user.authVersion || 0;
    const authVersionQuery =
      authVersion === 0
        ? {
            $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }],
          }
        : { authVersion };
    const modifiedUser = await new Promise<UserDocument | null>(
      (resolve, reject) => {
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
                .update(user.emailTemporary!.trim().toLowerCase())
                .digest('hex'),
            },
          },
          {
            // Return the document after updates if `new = true`
            new: true,
          },
          (err, modifiedUser) => (err ? reject(err) : resolve(modifiedUser)),
        );
      },
    );
    if (!modifiedUser) {
      res
        .status(400)
        .send({ message: 'Email confirm token is invalid or has expired.' });
      return;
    }
    await new Promise<void>((resolve, reject) => {
      req.login!(modifiedUser, err => (err ? reject(err) : resolve()));
    });
    result.user = userProfile.sanitizeOwnProfile(modifiedUser);
    res.json(result);
  }
  confirm().catch(err =>
    res.status(400).send({ message: errorService.getErrorMessage(err) }),
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

  async function resend(): Promise<void> {
    const salt = await new Promise<Buffer>((resolve, reject) => {
      crypto.randomBytes(20, (err, buffer) =>
        err ? reject(err) : resolve(buffer),
      );
    });
    const user = req.user!;
    user.set('updated', Date.now());
    setEmailConfirmationToken(
      user,
      authenticationService.generateEmailToken(user, salt),
    );
    await user.save();
    await new Promise<void>((resolve, reject) => {
      const done = (err?: Error | null) => (err ? reject(err) : resolve());
      if (isEmailChange) emailService.sendChangeEmailConfirmation(user, done);
      else emailService.sendSignupEmailConfirmation(user, done);
    });
  }
  resend().then(
    () => res.json({ message: 'Sent confirmation email.' }),
    err => res.status(400).send({ message: errorService.getErrorMessage(err) }),
  );
};

const defaultExport = service;
/** @esmNamed */
export const signup = service.signup;
/** @esmNamed */
export const signupValidation = service.signupValidation;
/** @esmNamed */
export const signin = service.signin;
/** @esmNamed */
export const signout = service.signout;
/** @esmNamed */
export const removeOAuthProvider = service.removeOAuthProvider;
/** @esmNamed */
export const validateEmailToken = service.validateEmailToken;
/** @esmNamed */
export const confirmEmail = service.confirmEmail;
/** @esmNamed */
export const resendConfirmation = service.resendConfirmation;
/** @esmNamed */
export const session = service.session;
export default defaultExport;
/** @commonjs */
export { defaultExport as 'module.exports' };
