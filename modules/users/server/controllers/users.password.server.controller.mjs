import {
  matchToken,
  setToken,
} from '../services/action-token.server.service.mjs';
import errorService from '../../../core/server/services/error.server.service.mjs';
import analyticsHandler from '../../../core/server/controllers/analytics.server.controller.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import profileHandler from './users.profile.server.controller.mjs';
import statService from '../../../stats/server/services/stats.server.service.mjs';
import log from '../../../../config/lib/logger.mjs';
import { ACCOUNT_IDENTIFIER_MAX_LENGTH } from '../lib/account-identifier.server.mjs';
import async from 'async';
import crypto from 'crypto';
import mongoose from 'mongoose';
const service = {};
/**
 * Module dependencies.
 */
const User = mongoose.model('User');

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
    const reportStat = status =>
      statService.stat(
        {
          namespace: 'passwordReset',
          counts: { count: 1 },
          tags: { status },
        },
        () => {},
      );

    crypto.randomBytes(20, (randomErr, buffer) => {
      if (randomErr) {
        log('error', 'Password recovery token generation failed.');
        return reportStat('failed:tokenGeneration');
      }

      User.findOne(
        { $or: [{ username: userHandle }, { email: userHandle }] },
        '-salt -password',
        (findErr, user) => {
          if (findErr) {
            log('error', 'Password recovery account lookup failed.');
            return reportStat('failed:lookup');
          }

          if (!user) {
            return reportStat('failed:noUser');
          }

          setToken(user, 'resetPasswordToken', buffer.toString('hex'));
          user.resetPasswordExpires = Date.now() + 24 * 3600000; // 24 hours

          user.save(saveErr => {
            if (saveErr) {
              log('error', 'Password recovery token save failed.');
              return reportStat('failed:tokenSave');
            }

            emailService.sendResetPassword(user, emailErr => {
              if (emailErr) {
                // Never include recipient addresses or provider error details.
                log('error', 'Password recovery email delivery failed.');
                return reportStat('failed:emailDelivery');
              }

              return reportStat('emailSent');
            });
          });
        },
      );
    });
  });
};

/**
 * Reset password GET from email token
 */
service.validateResetToken = function (req, res) {
  User.findOne(
    {
      resetPasswordToken: matchToken(req.params.token),
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    },
    function (err, user) {
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
        passwordResetUrl = analyticsHandler.appendUTMParams(passwordResetUrl, {
          source: req.query.utm_source,
          medium: req.query.utm_medium,
          campaign: req.query.utm_campaign,
        });
      }

      res.redirect(passwordResetUrl);
    },
  );
};

/**
 * Reset password POST from email token
 */
service.reset = async function (req, res) {
  const passwordDetails = req.body;
  if (passwordDetails.newPassword !== passwordDetails.verifyPassword) {
    return res.status(400).send({ message: 'Passwords do not match.' });
  }
  if (!User.isValidPassword(passwordDetails.newPassword)) {
    return res.status(400).send({ message: 'Password reset failed.' });
  }

  let password;
  try {
    password = await User.hashPassword(passwordDetails.newPassword);
  } catch (err) {
    if (err.code !== 'KDF_OVERLOADED') {
      log('error', 'Password reset credential generation failed.');
    }
    return res.status(err.status || 400).send({
      message: 'Password reset failed.',
    });
  }
  const now = new Date();
  User.findOneAndUpdate(
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
    (err, user) => {
      if (err || !user) {
        return res.status((err && err.status) || 400).send({
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
          emailErr => {
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
  async.waterfall(
    [
      // Some simple validations before proceeding
      function (done) {
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

        done(null);
      },

      // Find currently logged in user
      function (done) {
        User.findById(req.user.id, function (err, user) {
          done(err, user);
        });
      },

      // Authenticate with old password to check if it was correct
      function (user, done) {
        user
          .authenticate(req.body.currentPassword)
          .then(valid => {
            if (valid) return done(null, user);
            return done(new Error('Current password is incorrect.'));
          })
          .catch(done);
      },

      // Save user with new password
      function (user, done) {
        const oldPassword = user.password;
        const oldSalt = user.salt;
        const authVersion = user.authVersion;
        User.hashPassword(req.body.newPassword)
          .then(password => {
            const filter = { _id: user._id, password: oldPassword };
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
      function (user, done) {
        req.login(user, function (err) {
          if (err) return done(err);
          done(null, user);
        });
      },

      // Send email
      function (user) {
        emailService.sendResetPasswordConfirm(user, function (err) {
          if (err) {
            log('error', 'Password change confirmation email delivery failed.');
          }
          return res.send({
            user: profileHandler.sanitizeOwnProfile(user),
            message: 'Password changed successfully!',
          });
        });
      },
    ],
    function (err) {
      /* istanbul ignore else */
      if (err) {
        res.status(err.status || 400).send({
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
