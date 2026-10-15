import {
  matchToken,
  setToken,
} from '../services/action-token.server.service.mts';
import errorService from '../../../core/server/services/error.server.service.mjs';
import analyticsHandler from '../../../core/server/controllers/analytics.server.controller.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import profileHandler from './users.profile.server.controller.mjs';
import statService from '../../../stats/server/services/stats.server.service.mts';
import log from '../../../../config/lib/logger.mjs';
import { ACCOUNT_IDENTIFIER_MAX_LENGTH } from '../lib/account-identifier.server.mts';
import async from 'async';
import crypto from 'crypto';
import mongoose, { type FilterQuery, type UpdateQuery } from 'mongoose';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';

interface PasswordRequest {
  body: Record<string, unknown> & {
    currentPassword?: string;
    newPassword?: unknown;
    verifyPassword?: unknown;
  };
  params: Record<string, string>;
  query: Record<string, unknown>;
  user?: UserServerDocument;
  login(
    user: UserServerDocument,
    callback: (error: Error | null) => void,
  ): void;
}

interface PasswordResponse {
  status(code: number): PasswordResponse;
  send(body: unknown): unknown;
  json(body: unknown): unknown;
  redirect(path: string): unknown;
}

type WaterfallCallback = (error?: Error | null, ...results: unknown[]) => void;

interface PasswordError extends Error {
  status?: number;
  code?: string;
}

interface PasswordController {
  forgot(req: PasswordRequest, res: PasswordResponse): void;
  validateResetToken(req: PasswordRequest, res: PasswordResponse): void;
  reset(req: PasswordRequest, res: PasswordResponse): Promise<unknown>;
  changePassword(req: PasswordRequest, res: PasswordResponse): void;
}

const appendUTMParams: typeof import('../../../core/server/controllers/analytics.server.controller.mts').appendUTMParams =
  analyticsHandler.appendUTMParams;

const service = {} as PasswordController;
/**
 * Module dependencies.
 */
const User = mongoose.model<UserServerRecord, UserServerModel>('User');

function findOneAndUpdateWithCallback(
  filter: FilterQuery<UserServerRecord>,
  update: UpdateQuery<UserServerRecord>,
  options: { new: boolean; runValidators?: boolean },
  callback: (error: Error | null, user: UserServerDocument | null) => void,
): void {
  User.findOneAndUpdate(filter, update, options).then(
    user => callback(null, user),
    (error: Error) => callback(error, null),
  );
}

/**
 * Forgot for reset password (forgot POST)
 */
service.forgot = function (req, res) {
  if (
    typeof req.body?.username !== 'string' ||
    !req.body.username ||
    req.body.username.length > ACCOUNT_IDENTIFIER_MAX_LENGTH
  ) {
    return res.status(400).send({
      message: 'Please, we really need your username or email first...',
    });
  }

  const acknowledge = () =>
    res.status(200).send({
      message:
        'If an account matches that username or email, we will send recovery instructions.',
    });
  const userHandle = req.body.username.toLowerCase();
  acknowledge();

  // Account lookup, persistence, and email delivery must not affect the
  // recovery response's latency or reveal whether an account exists.
  setImmediate(() => {
    const reportStat = (status: string) =>
      statService.stat(
        {
          namespace: 'passwordReset',
          counts: { count: 1 },
          tags: { status },
        },
        () => {},
      );

    crypto.randomBytes(20, (randomErr: Error | null, buffer: Buffer) => {
      if (randomErr) {
        log('error', 'Password recovery token generation failed.');
        return reportStat('failed:tokenGeneration');
      }

      User.findOne(
        { $or: [{ username: userHandle }, { email: userHandle }] },
        '-salt -password',
      ).then(
        (user: UserServerDocument | null) => {
          if (!user) {
            return reportStat('failed:noUser');
          }

          setToken(user, 'resetPasswordToken', buffer.toString('hex'));
          user.resetPasswordExpires = Date.now() + 24 * 3600000; // 24 hours

          user.save().then(
            () => {
              emailService.sendResetPassword(
                user,
                (emailErr?: Error | null) => {
                  if (emailErr) {
                    // Never include recipient addresses or provider error details.
                    log('error', 'Password recovery email delivery failed.');
                    return reportStat('failed:emailDelivery');
                  }

                  return reportStat('emailSent');
                },
              );
            },
            () => {
              log('error', 'Password recovery token save failed.');
              return reportStat('failed:tokenSave');
            },
          );
        },
        () => {
          log('error', 'Password recovery account lookup failed.');
          return reportStat('failed:lookup');
        },
      );
    });
  });
};

/**
 * Reset password GET from email token
 */
service.validateResetToken = function (req, res) {
  User.findOne({
    resetPasswordToken: matchToken(req.params.token),
    resetPasswordExpires: {
      $gt: Date.now(),
    },
  }).then(
    (user: UserServerDocument | null) => {
      if (!user) {
        return res.redirect('/password/reset/invalid');
      }

      let passwordResetUrl = '/password/reset/' + req.params.token;

      // Re-apply possible UTM variables to the redirect URL
      if (
        req.query &&
        req.query.utm_source &&
        req.query.utm_medium &&
        req.query.utm_campaign
      ) {
        passwordResetUrl = appendUTMParams(passwordResetUrl, {
          source: req.query.utm_source,
          medium: req.query.utm_medium,
          campaign: req.query.utm_campaign,
        });
      }

      res.redirect(passwordResetUrl);
    },
    () => res.redirect('/password/reset/invalid'),
  );
};

/**
 * Reset password POST from email token
 */
service.reset = async function (req, res) {
  const passwordDetails = req.body;
  const newPassword = passwordDetails.newPassword;
  if (newPassword !== passwordDetails.verifyPassword) {
    return res.status(400).send({ message: 'Passwords do not match.' });
  }
  if (!User.isValidPassword(newPassword)) {
    return res.status(400).send({ message: 'Password reset failed.' });
  }

  let password;
  try {
    password = await User.hashPassword(newPassword);
  } catch (error: unknown) {
    const err = error as PasswordError;
    if (err.code !== 'KDF_OVERLOADED') {
      log('error', 'Password reset credential generation failed.');
    }
    return res.status(err.status || 400).send({
      message: 'Password reset failed.',
    });
  }
  const now = new Date();
  findOneAndUpdateWithCallback(
    {
      resetPasswordToken: matchToken(req.params.token),
      resetPasswordExpires: { $gt: now },
    },
    {
      $set: {
        password,
        passwordUpdated: now,
      },
      $unset: {
        salt: 1,
        resetPasswordToken: 1,
        resetPasswordExpires: 1,
      },
      $inc: { authVersion: 1 },
    },
    { new: true, runValidators: true },
    (err: Error | null, user: UserServerDocument | null) => {
      if (err || !user) {
        const passwordError = err as PasswordError | null;
        return res.status(passwordError?.status || 400).send({
          message: err
            ? 'Password reset failed.'
            : 'Password reset token is invalid or has expired.',
        });
      }

      req.login(user, loginErr => {
        if (loginErr) {
          log('error', 'Authenticating user after password reset failed.');
          return res.status(400).send({ message: 'Password reset failed.' });
        }

        emailService.sendResetPasswordConfirm(
          { displayName: user.displayName, email: user.email },
          (emailErr?: Error | null) => {
            if (emailErr) {
              log(
                'error',
                'Password reset confirmation email delivery failed.',
              );
            }
            return res.json(profileHandler.sanitizeOwnProfile(user));
          },
        );
      });
    },
  );
};

/**
 * Change Password
 */
service.changePassword = function (req, res) {
  let validatedNewPassword: string | undefined;
  async.waterfall(
    [
      // Some simple validations before proceeding
      function (done: WaterfallCallback) {
        // Return error if no user
        if (!req.user) {
          return res.status(403).send({
            message: errorService.getErrorMessageByKey('forbidden'),
          });
        }

        // Check if we have new password coming up
        if (!req.body.newPassword) {
          return done(new Error('Please provide a new password.'));
        }

        // Check if new password matches verification
        if (req.body.newPassword !== req.body.verifyPassword) {
          return done(new Error('Passwords do not match.'));
        }
        if (!User.isValidPassword(req.body.newPassword)) {
          return done(
            new Error('Password should be more than 8 characters long.'),
          );
        }
        validatedNewPassword = req.body.newPassword;

        done(null);
      },

      // Find currently logged in user
      function (done: WaterfallCallback) {
        User.findById(req.user!.id).then(
          (user: UserServerDocument | null) => done(null, user),
          done,
        );
      },

      // Authenticate with old password to check if it was correct
      function (user: UserServerDocument, done: WaterfallCallback) {
        user
          .authenticate(req.body.currentPassword)
          .then((valid: boolean) => {
            if (valid) return done(null, user);
            return done(new Error('Current password is incorrect.'));
          })
          .catch(done);
      },

      // Save user with new password
      function (user: UserServerDocument, done: WaterfallCallback) {
        const oldPassword = user.password;
        const oldSalt = user.salt;
        const authVersion = user.authVersion;
        User.hashPassword(validatedNewPassword!)
          .then((password: string) => {
            const filter: FilterQuery<UserServerRecord> = {
              _id: user._id,
              password: oldPassword,
            };
            if (oldSalt === undefined) {
              filter.salt = { $exists: false };
            } else {
              filter.salt = oldSalt;
            }
            if (authVersion === undefined || authVersion === 0) {
              filter.$or = [
                { authVersion: { $exists: false } },
                { authVersion: authVersion ?? 0 },
              ];
            } else {
              filter.authVersion = authVersion;
            }

            return User.findOneAndUpdate(
              filter,
              {
                $set: { password, passwordUpdated: new Date() },
                $unset: { salt: 1 },
                $inc: { authVersion: 1 },
              },
              { new: true, runValidators: true },
            ).then(updatedUser => {
              if (!updatedUser) {
                return done(new Error('Current password is incorrect.'));
              }
              return done(null, updatedUser);
            });
          })
          .catch(done);
      },

      // Login again and return new user
      function (user: UserServerDocument, done: WaterfallCallback) {
        req.login(user, function (err?: Error | null) {
          if (err) return done(err);
          done(null, user);
        });
      },

      // Send email
      function (user: UserServerDocument) {
        emailService.sendResetPasswordConfirm(
          user,
          function (err?: Error | null) {
            if (err) {
              log(
                'error',
                'Password change confirmation email delivery failed.',
              );
            }
            return res.send({
              user: profileHandler.sanitizeOwnProfile(user),
              message: 'Password changed successfully!',
            });
          },
        );
      },
    ],
    function (err: Error | null | undefined) {
      /* istanbul ignore else */
      if (err) {
        res.status((err as PasswordError).status || 400).send({
          message: err.message || errorService.getErrorMessageByKey('default'),
        });
      }
    },
  );
};

const defaultExport = service;
export const forgot = service.forgot;
export const validateResetToken = service.validateResetToken;
export const reset = service.reset;
export const changePassword = service.changePassword;
export default defaultExport;
export { defaultExport as 'module.exports' };
