import {
  hashToken,
  matchToken,
} from '../services/action-token.server.service.mjs';
import { setEmailConfirmationToken } from '../services/email-confirmation.server.service.mjs';
import { readFileSync } from 'node:fs';
import getContactHandlerModule from './../../../contacts/server/controllers/contacts.server.controller.mjs';
import getMessageHandlerModule from './../../../messages/server/controllers/messages.server.controller.mjs';
import getOfferHandlerModule from './../../../offers/server/controllers/offers.server.controller.mjs';
import _ from 'lodash';
import path from 'path';
import errorService from './../../../core/server/services/error.server.service.mjs';
import textService from './../../../core/server/services/text.server.service.mjs';
import tribesHandler from './../../../tribes/server/controllers/tribes.server.controller.mjs';
import authenticationService from '../services/authentication.server.service.mjs';
import emailServiceModule from './../../../core/server/services/email.server.service.mjs';
import statService from './../../../stats/server/services/stats.server.service.mts';
import log from './../../../../config/lib/logger.mjs';
import fileRemovalServiceModule from '../../../core/server/services/file-removal.server.service.mjs';
import messageStatService from './../../../messages/server/services/message-stat.server.service.mjs';
import config from './../../../../config/config.mts';
import async from 'async';
import crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';
import mongoose from 'mongoose';
import moment from 'moment';
import * as nip19 from 'nostr-tools/nip19';
import validator from 'validator';
import type {
  ProfilePayload,
  SanitizedProfileRequest,
  UserProfileController,
} from './users.profile.server.contracts.mts';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
import deprecatedLanguages from './../../../../config/languages/deprecated.mts';
import {
  profileQueryFields,
  selectMiniProfileResponse,
  selectProfileResponse,
  selectProfileUpdateFields,
} from '../services/profile-response.server.service.mts';
import { userMiniProfileFields as miniProfileFields } from '../services/user-mini.server.service.mjs';
import mfaService from '../services/mfa.server.service.mjs';

const locales: Array<{ code: string }> = JSON.parse(
  readFileSync(
    new URL('../../../../config/shared/locales.json', import.meta.url),
    'utf8',
  ),
);
const service = {} as UserProfileController;
type ErrorDone = (error?: Error | null) => void;
const emailService = emailServiceModule as {
  sendEmailChangeNotificationToOldAddress(
    user: UserServerDocument,
    oldAddress: string,
    callback: (error: Error | null) => void,
  ): void;
  sendChangeEmailConfirmation(
    user: UserServerDocument,
    callback: (error: Error | null) => void,
  ): void;
  sendRemoveProfile(
    user: UserServerDocument | null,
    callback: (error?: Error | null) => void,
  ): void;
  sendRemoveProfileConfirmed(
    user: Pick<UserServerRecord, 'displayName' | 'email'>,
    callback: (error: Error | null) => void,
  ): void;
};
const fileRemovalService = fileRemovalServiceModule as {
  removeLocalPath(path: string): Promise<void>;
};
type TribeCountResult = NonNullable<
  Parameters<Parameters<typeof tribesHandler.updateCount>[3]>[1]
>;
type PopulatedTribeDocument = TribeCountResult & {
  _id: mongoose.Types.ObjectId;
};

function hasTribeId(
  tribe: TribeCountResult | null | undefined,
): tribe is PopulatedTribeDocument {
  return Boolean(tribe && tribe._id);
}

/**
 * Module dependencies.
 */

const getContactHandler = () =>
  getContactHandlerModule as unknown as {
    removeAllByUserId(
      userId: mongoose.Types.ObjectId,
      callback: (error?: Error | null) => void,
    ): void;
  };
const getMessageHandler = () =>
  getMessageHandlerModule as unknown as {
    markAllMessagesToUserNotified(
      userId: mongoose.Types.ObjectId,
      callback: (error?: Error | null) => void,
    ): void;
  };
const getOfferHandler = () =>
  getOfferHandlerModule as unknown as {
    removeAllByUserId(
      userId: mongoose.Types.ObjectId,
      callback: (error?: Error | null) => void,
    ): void;
  };
const User = mongoose.model<UserServerRecord, UserServerModel>('User');

// Fields to send publicly about any user profile
// to make sure we're not sending unsecure content (eg. passwords)
// Pick here fields to send
service.userProfileFields = profileQueryFields.join(' ');

// Restricted set of profile fields when only really "miniprofile" is needed.
// Single source of truth lives in the user-mini service.
service.userMiniProfileFields = miniProfileFields;

// Mini + a few fields we'll need at listings
service.userListingProfileFields =
  service.userMiniProfileFields + ' member birthdate gender tagline';
service.userSearchProfileFields =
  service.userMiniProfileFields + ' gender locationFrom locationLiving tagline';

/**
 * Update user profile
 */
service.update = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  if (
    Object.prototype.hasOwnProperty.call(req.body, 'email') &&
    (typeof req.body.email !== 'string' ||
      (req.body.email.trim() !== '' &&
        !validator.isEmail(req.body.email.trim())))
  ) {
    return res.status(400).send({
      message: 'Please enter a valid email address.',
    });
  }
  if (typeof req.body.email === 'string') {
    req.body.email = req.body.email.trim().toLowerCase();
    if (
      req.body.email &&
      req.body.email !== req.user.email &&
      req.user.public === true
    ) {
      return res.status(400).send({
        message:
          'Email changes require your current password and authenticator code when enabled.',
      });
    }
  }
  const authenticatedUser = req.user;
  const requestedEmail = req.body.email as string | undefined;

  if (Object.prototype.hasOwnProperty.call(req.body, 'username')) {
    if (typeof req.body.username !== 'string') {
      return res
        .status(400)
        .send({ message: authenticationService.usernameFormatMessage });
    }
    const selectedUsername = req.body.username.trim();
    req.body.username = selectedUsername.toLowerCase();
    if (
      req.body.username !== authenticatedUser.username &&
      !authenticationService.validateUsername(selectedUsername)
    ) {
      return res.status(400).send({
        message: authenticationService.isUsernameFormatValid(selectedUsername)
          ? 'Username is not available.'
          : authenticationService.usernameFormatMessage,
      });
    }
  }

  // validate locale
  // @TODO validation framework
  const localeCodes = locales.map(function (locale) {
    return locale.code;
  });
  if (
    req.body.locale &&
    (typeof req.body.locale !== 'string' ||
      !localeCodes.includes(req.body.locale))
  ) {
    return errorService.sendBadRequest(res, undefined);
  }
  if (req.body.languages) {
    const existingLanguages = new Set(authenticatedUser.languages!);
    const requestedLanguages = Array.isArray(req.body.languages)
      ? req.body.languages
      : [req.body.languages];
    const addedDeprecatedLanguage = requestedLanguages.some(
      code =>
        typeof code === 'string' &&
        deprecatedLanguages.has(code) &&
        !existingLanguages.has(code),
    );
    if (addedDeprecatedLanguage) {
      return res.status(400).send({
        message: 'This language can no longer be added to profiles.',
      });
    }
  }

  // Validate nostr npub - must be a public key, not nsec (secret key)
  if (Object.prototype.hasOwnProperty.call(req.body, 'nostrNpub')) {
    if (typeof req.body.nostrNpub !== 'string') {
      return res.status(400).send({
        message:
          'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
      });
    }
    const trimmedNpub = req.body.nostrNpub.trim().toLowerCase();
    req.body.nostrNpub = trimmedNpub;
    try {
      if (trimmedNpub) {
        const result = nip19.decode(trimmedNpub);
        if (result.type !== 'npub' || !/^[0-9a-f]{64}$/i.test(result.data)) {
          throw new Error('Invalid nostr npub.');
        }
        req.body.nostrNpub = nip19.npubEncode(result.data.toLowerCase());
      }
    } catch (err) {
      _.noop(err);
      return res.status(400).send({
        message:
          'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
      });
    }
  }
  const requestedNostrNpub =
    typeof req.body.nostrNpub === 'string' ? req.body.nostrNpub : undefined;
  async.waterfall(
    [
      function (done: (error?: Error | null) => void) {
        // Email didn't change, just continue
        if (!requestedEmail || requestedEmail === authenticatedUser.email) {
          return done();
        }

        // User is changing email, check if it's available
        User.findOne(
          {
            $or: [
              {
                emailTemporary: requestedEmail.toLowerCase(),
              },
              {
                email: requestedEmail.toLowerCase(),
              },
            ],
          },
          'emailTemporary email',
          function (err: Error | null, emailUser: UserServerDocument | null) {
            // Not available
            if (emailUser) {
              // If the user we found with this email is currently authenticated user,
              // let user pass to resend confirmation email
              if (emailUser._id.equals(authenticatedUser._id)) {
                done();
              } else {
                // Otherwise it was someone else's email. Block the way.
                return res.status(403).send({
                  message:
                    'This email is already in use. Please use another one.',
                });
              }
            } else {
              // Email available, proceed generating the token
              done();
            }
          },
        );
      },
      // Check if nostr npub is already claimed by another user
      function (done: (error?: Error | null) => void) {
        if (!requestedNostrNpub) {
          return done();
        }
        User.findOne(
          {
            _id: {
              $ne: authenticatedUser._id,
            },
            nostrNpub: requestedNostrNpub,
          },
          '_id',
          function (
            err: Error | null,
            existingNostrUser: UserServerDocument | null,
          ) {
            if (err) {
              return done(err);
            }
            if (existingNostrUser) {
              return res.status(403).send({
                message:
                  'This nostr npub is already in use. Please use another one.',
              });
            }
            done();
          },
        );
      },
      // Check if we should generate new email token
      function (
        done: (
          error: Error | null,
          token: string | false,
          email: string | false,
        ) => void,
      ) {
        // Generate only if email changed
        if (requestedEmail && requestedEmail !== authenticatedUser.email) {
          crypto.randomBytes(20, function (err: Error | null, buffer: Buffer) {
            const token = buffer.toString('hex');
            done(err, token, requestedEmail);
          });
        } else {
          // Email didn't change, just continue
          done(null, false, false);
        }
      },
      // User wants to change the username
      function (
        token: string | false,
        email: string | false,
        done: (
          error: Error | null,
          token: string | false,
          email: string | false,
        ) => void,
      ) {
        if (
          typeof req.body.username === 'string' &&
          req.body.username &&
          req.body.username !== authenticatedUser.username
        ) {
          // They are not allowed to do so
          if (!isUsernameUpdateAllowed(authenticatedUser)) {
            return res.status(403).send({
              message: 'You cannot change your username at this time.',
            });
          }

          // Mark username updated
          authenticatedUser.usernameUpdated = new Date();
        }
        done(null, token, email);
      },
      // Update user
      function (
        token: string | false,
        email: string | false,
        done: (
          error: Error | null,
          token: string | false,
          user: UserServerDocument,
        ) => void,
      ) {
        const user = Object.assign(
          authenticatedUser,
          selectProfileUpdateFields(req.body),
        );
        user.set('updated', Date.now());

        // This is set only if user edited email
        if (token && email) {
          setEmailConfirmationToken(user, token);
          user.emailTemporary = email;
        }
        user.save(function (err: Error | null) {
          done(err, token, user);
        });
      },
      // Send email
      function (
        token: string | false,
        user: UserServerDocument,
        done: (
          error: Error | null | undefined,
          user: UserServerDocument,
        ) => void,
      ) {
        if (token) {
          emailService.sendChangeEmailConfirmation(
            user,
            function (err: Error | null) {
              done(err, user);
            },
          );
        } else {
          done(null, user);
        }
      },
      // Return user
      function (user: UserServerDocument) {
        const sanitizedUser = service.sanitizeProfile(user, authenticatedUser);
        return res.json(sanitizedUser);
      },
    ],
    function (err) {
      if (err) {
        return errorService.sendBadRequest(res, err);
      }
    },
  );
};

/**
 * Stage an email change after fresh password and, when enabled, MFA proof.
 */
service.changeEmail = async function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }

  const email = req.body?.email;
  if (typeof email !== 'string' || !validator.isEmail(email.trim())) {
    return res.status(400).send({
      message: 'Please enter a valid email address.',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === req.user.email) {
    return res.json(service.sanitizeOwnProfile(req.user));
  }

  try {
    const user = await User.findById(req.user._id).exec();
    if (!user || user.public !== true) {
      return res.status(400).send({
        message: 'Confirm your current email address before changing it.',
      });
    }

    const validPassword =
      typeof req.body.currentPassword === 'string' &&
      (await user.authenticate(req.body.currentPassword));
    if (
      !validPassword ||
      (user.authVersion || 0) !== (req.user.authVersion || 0)
    ) {
      return res.status(400).send({
        message: 'Password or authenticator confirmation failed.',
      });
    }

    const existingUser = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ email: normalizedEmail }, { emailTemporary: normalizedEmail }],
    })
      .select('_id')
      .lean()
      .exec();
    if (existingUser) {
      return res.status(403).send({
        message: 'This email is already in use. Please use another one.',
      });
    }

    if (
      user.mfaEnabled === true &&
      !(await mfaService.verifyAndConsume(
        user._id,
        req.body.mfaCode,
        Date.now(),
        user.authVersion || 0,
      ))
    ) {
      return res.status(400).send({
        message: 'Password or authenticator confirmation failed.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const authVersion = user.authVersion || 0;
    const tokenState: {
      $locals: Record<string, unknown>;
      emailToken?: string;
      emailTokenIssuedAt?: Date;
      emailTokenExpires?: Date;
    } = { $locals: {} };
    setEmailConfirmationToken(tokenState, token);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        ...(authVersion === 0
          ? { $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }] }
          : { authVersion }),
        email: user.email,
      },
      {
        $set: {
          emailTemporary: normalizedEmail,
          emailToken: tokenState.emailToken,
          emailTokenIssuedAt: tokenState.emailTokenIssuedAt,
          emailTokenExpires: tokenState.emailTokenExpires,
          updated: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).exec();

    if (!updatedUser) {
      return res.status(400).send({
        message: 'Password or authenticator confirmation failed.',
      });
    }

    setEmailConfirmationToken(
      updatedUser,
      token,
      tokenState.emailTokenIssuedAt,
    );

    await Promise.all([
      new Promise<void>((resolve, reject) =>
        emailService.sendChangeEmailConfirmation(updatedUser, error =>
          error ? reject(error) : resolve(),
        ),
      ),
      new Promise<void>((resolve, reject) =>
        emailService.sendEmailChangeNotificationToOldAddress(
          updatedUser,
          user.email,
          error => (error ? reject(error) : resolve()),
        ),
      ),
    ]);

    return res.json(service.sanitizeOwnProfile(updatedUser));
  } catch (error) {
    log('error', 'Could not stage account email change', error);
    return res.status(503).send({
      message: 'Could not send email change confirmation. Please try again.',
    });
  }
};

/** Cancel the current pending email change without affecting the current address. */
service.cancelEmailChange = async function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }

  try {
    const pendingEmail = req.user.emailTemporary;
    const pendingToken = req.user.emailToken;
    const authVersion = req.user.authVersion || 0;
    const authVersionQuery =
      authVersion === 0
        ? { $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }] }
        : { authVersion };
    const hasPendingSnapshot =
      typeof pendingEmail === 'string' &&
      pendingEmail !== '' &&
      typeof pendingToken === 'string' &&
      pendingToken !== '';
    const user = hasPendingSnapshot
      ? await User.findOneAndUpdate(
          {
            _id: req.user._id,
            public: true,
            emailTemporary: pendingEmail,
            emailToken: pendingToken,
            $and: [authVersionQuery],
          },
          {
            $unset: {
              emailTemporary: 1,
              emailToken: 1,
              emailTokenIssuedAt: 1,
              emailTokenExpires: 1,
            },
            $set: { updated: new Date() },
          },
          { new: true },
        ).exec()
      : null;
    if (!user) {
      const currentUser = await User.findOne({
        _id: req.user._id,
        public: true,
      }).exec();
      if (!currentUser) return errorService.sendForbidden(res);
      if (currentUser.emailTemporary) {
        return res.status(409).send({
          message:
            'The pending email change has changed. Refresh your account and try again.',
        });
      }
      return res.json(service.sanitizeOwnProfile(currentUser));
    }
    return res.json(service.sanitizeOwnProfile(user));
  } catch (error) {
    log('error', 'Could not cancel account email change', error);
    return res.status(503).send({
      message: 'Could not cancel the pending email change. Please try again.',
    });
  }
};

/**
 * Initialize profile removal
 */
service.initializeRemoveProfile = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  const authenticatedUser = req.user;

  // Don't let suspended or shadowbanned users remove themself, ask them to get in touch with support instead.
  if (
    req.user.roles.includes('suspended') ||
    req.user.roles.includes('shadowban')
  ) {
    return res.status(403).send({
      message:
        'Oops! Something went wrong. Please get in touch with support at trustroots.org/support',
    });
  }
  async.waterfall(
    [
      // Generate random token
      function (done: (error: Error | null, token: string) => void) {
        crypto.randomBytes(20, function (err: Error | null, buffer: Buffer) {
          const token = buffer.toString('hex');
          done(err, token);
        });
      },
      // Set token
      function (
        token: string,
        done: (error: Error | null, user: UserServerDocument | null) => void,
      ) {
        // Token expires in 24 hours
        const tokenExpires = Date.now() + 24 * 3600000;
        User.findOneAndUpdate(
          {
            _id: authenticatedUser._id,
          },
          {
            $set: {
              removeProfileToken: hashToken(token),
              removeProfileExpires: tokenExpires,
            },
          },
          {
            // Return updated user document
            new: true,
          },
          function (err: Error | null, result: UserServerRecord | null) {
            if (result) {
              const user = result as UserServerDocument;
              user.$locals.actionTokens = { removeProfileToken: token };
              return done(err, user);
            }
            done(err, null);
          },
        );
      },
      // Send email
      function (user: UserServerDocument | null) {
        emailService.sendRemoveProfile(user, function (err?: Error | null) {
          // Stop on errors
          if (err) {
            return res.status(400).send({
              message:
                'Failure while sending confirmation email to you. Please try again later.',
            });
          }

          // Report successfull reset to stats
          return statService.stat(
            {
              namespace: 'profileRemoval',
              counts: {
                count: 1,
              },
              tags: {
                status: 'emailSent',
              },
            },
            function () {
              // Return success
              res.send({
                message: 'We sent you an email with further instructions.',
              });
            },
          );
        });
      },
    ],
    function (err?: Error | null) {
      if (err) {
        return res.status(400).send({
          message: 'Removing your profile failed.',
        });
      }
    },
  );
};

/**
 * Remove profile DELETE from email token
 */
service.removeProfile = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  const authenticatedUser = req.user;
  async.waterfall(
    [
      // Validate token
      function (done: (error: Error | null, user: UserServerRecord) => void) {
        User.findOne(
          {
            _id: authenticatedUser._id,
            removeProfileToken: matchToken(req.params.token),
            removeProfileExpires: {
              $gt: Date.now(),
            },
          },
          function (err: Error | null, user: UserServerRecord | null) {
            // Can't find user (=invalid or expired token) or other error
            if (err || !user) {
              // Report failure to stats
              return statService.stat(
                {
                  namespace: 'profileRemoval',
                  counts: {
                    count: 1,
                  },
                  tags: {
                    status: 'failed',
                  },
                },
                function () {
                  // Return failure
                  return res.status(400).send({
                    message: 'Profile remove token is invalid or has expired.',
                  });
                },
              );
            }
            done(null, user);
          },
        );
      },
      // Remove profile
      function (
        user: UserServerRecord,
        done: (error: Error | null | undefined, user: UserServerRecord) => void,
      ) {
        User.findOneAndRemove(
          {
            _id: user._id,
          },
          function (err?: Error | null) {
            done(err, user);
          },
        );
      },
      // Remove native message alert registrations
      function (
        user: UserServerRecord,
        done: (error: Error | null | undefined, user: UserServerRecord) => void,
      ) {
        mongoose.model('UnifiedPushRegistration').deleteMany(
          {
            user: user._id,
          },
          function (err: Error | null) {
            if (err) {
              log('error', 'Error removing message alert registrations.', {
                error: err,
              });
            }
            done(null, user);
          },
        );
      },
      // Remove offers
      function (
        user: UserServerRecord,
        done: (error: Error | null | undefined, user: UserServerRecord) => void,
      ) {
        getOfferHandler().removeAllByUserId(user._id, function (err) {
          if (err) {
            log('error', 'Error when removing all offers by user ID. #rj393', {
              error: err,
            });
          }
          done(null, user);
        });
      },
      // Remove contacts
      function (
        user: UserServerRecord,
        done: (error: Error | null | undefined, user: UserServerRecord) => void,
      ) {
        getContactHandler().removeAllByUserId(user._id, function (err) {
          if (err) {
            log(
              'error',
              'Error when removing all contacts by user ID. #j93hdd',
              {
                error: err,
              },
            );
          }
          done(null, user);
        });
      },
      // Mark all messages sent _to_ that user as `notified:true` (so that unread-messages doesn't pick them up anymore). Leave messages _from_ that user as is.
      function (
        user: UserServerRecord,
        done: (error: Error | null | undefined, user: UserServerRecord) => void,
      ) {
        getMessageHandler().markAllMessagesToUserNotified(
          user._id,
          function (err?: Error | null) {
            return done(err, user);
          },
        );
      },
      // Subtract 1 from all the tribes.count of which user is member
      function (
        user: UserServerRecord,
        done: (error: Error | null | undefined, user: UserServerRecord) => void,
      ) {
        async.each(
          user.member,
          function (
            membership: UserServerRecord['member'][number],
            callback: (error?: Error | null) => void,
          ) {
            // Update the count of every tribe user is member of
            tribesHandler.updateCount(membership.tribe, -1, false, callback);
          },
          function (err?: Error | null) {
            done(err, user);
          },
        );
      },
      // Remove uploaded images
      function (
        user: UserServerRecord,
        done: (error: Error | null, user: UserServerRecord) => void,
      ) {
        // All user's uploads are under their own folder
        fileRemovalService
          .removeLocalPath(path.resolve(config.uploadDir) + '/' + user._id)
          .then(
            () => done(null, user),
            (error: Error) => done(error, user),
          );
      },
      // Send email
      function (user: UserServerRecord, done: (error?: Error | null) => void) {
        emailService.sendRemoveProfileConfirmed(
          {
            displayName: user.displayName,
            email: user.email,
          },
          function (err: Error | null) {
            // Just log errors but don't mind about them as this is not critical step
            if (err) {
              // Log the failure to send the email
              log(
                'error',
                'Sending confirmation email about successfull profile removal failed #289hhs',
                {
                  error: err,
                },
              );
            }
            done();
          },
        );
      },
      // Done
      function () {
        // Report successfull removal to stats
        return statService.stat(
          {
            namespace: 'profileRemoval',
            counts: {
              count: 1,
            },
            tags: {
              status: 'removed',
            },
          },
          function () {
            // Return success
            return res.json({
              message: 'Your profile has been removed.',
            });
          },
        );
      },
    ],
    function (err?: Error | null) {
      if (err) {
        // Report failure to stats
        return statService.stat(
          {
            namespace: 'profileRemoval',
            counts: {
              count: 1,
            },
            tags: {
              status: 'failed',
            },
          },
          function () {
            // Return failure
            return res.status(400).send({
              message: 'Removing your profile failed.',
            });
          },
        );
      }
    },
  );
};

/**
 * Show the profile of the user
 */
service.getUser = function (req: SanitizedProfileRequest, res) {
  // Not a profile of currently authenticated user:
  if (req.profile && !req.user._id.equals(req.profile._id)) {
    // 'public' isn't needed at frontend.
    // We had to bring it until here trough
    // ACL policy since it's needed there.
    // `req.profile.toObject()` is done at sanitizeProfile() before this.
    delete req.profile.public;
    res.json(req.profile);
  } else {
    // Profile of currently authenticated user:
    res.json(req.profile || {});
  }
};

/**
 * Show the mini profile of the user
 */
service.getMiniUser = function (req, res) {
  if (req.profile) {
    const profile = req.profile.toObject();
    // 'public' and 'roles' are only used by access checks. The existing
    // endpoint also returns 'blocked', so keep that response field while
    // allowing only the explicit mini-profile projection through.
    return res.json(selectMiniProfileResponse(profile));
  }
  res.json({});
};
function classifyPermission(
  user: UserServerDocument,
  profile: UserServerDocument,
) {
  const isOwnProfile = user._id.equals(profile._id);
  const isBannedProfile =
    profile.roles.includes('suspended') || profile.roles.includes('shadowban');
  // Only full admins may view banned profiles; moderators no longer have this access.
  const isAdmin = user.roles.includes('admin');
  const isBlocked = !!profile.blocked && profile.blocked.indexOf(user._id) >= 0;
  const hasBlocked = !!user.blocked && user.blocked.indexOf(profile._id) >= 0;
  return {
    isOwnProfile,
    isBannedProfile,
    isAdmin,
    isBlocked,
    hasBlocked,
  };
}

/** Filter out users that has blocked the logged */
function createBlockingUserFilter(loggedUser: UserServerDocument) {
  /** check if blocked, a bit tricky because are mongoose ObjectID */
  const isBlocked = (blockedList: UserServerRecord['blocked'] | undefined) =>
    !!blockedList && blockedList.some(blc => blc.equals(loggedUser.id));
  return (users: UserServerDocument[]) => {
    const res: Array<Omit<UserServerRecord, 'blocked'>> = [];
    users.reduce((acc, cur) => {
      /** remove blocked field */
      const { blocked, ...rest } = cur.toObject();
      /** check if blocked*/
      if (!isBlocked(blocked)) {
        acc.push(rest); // not blocked
      }
      return acc;
    }, res);
    return res;
  };
}

/**
 * Mini profile middleware
 */
service.userMiniByID = function (req, res, next, userId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return errorService.sendInvalidId(res);
  }
  User.findById(
    userId,
    service.userMiniProfileFields + ' public roles blocked',
  ).exec(function (err, profile) {
    // Something went wrong or no profile
    if (err || !profile) {
      return errorService.sendNotFound(res);
    }
    const { isAdmin, isOwnProfile, isBannedProfile, isBlocked, hasBlocked } =
      classifyPermission(req.user, profile);
    // Not own profile, and not public, or suspended, or shadowbanned user
    if (
      !isAdmin &&
      !isOwnProfile &&
      (!profile.public || isBannedProfile || isBlocked || hasBlocked)
    ) {
      return errorService.sendNotFound(res);
    }
    req.profile = profile;
    next();
  });
};

/**
 * Profile middleware
 */
service.userByUsername = function (req, res, next, username) {
  // Require user
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  const authenticatedUser = req.user;

  // Proper 'username' value required
  if (
    typeof username !== 'string' ||
    username.trim() === '' ||
    username.length < 3
  ) {
    return res.status(400).send({
      message: 'Valid username required.',
    });
  }
  async.waterfall(
    [
      // Find user
      function (
        done: (error: Error | null, profile: UserServerDocument) => void,
      ) {
        User.findOne(
          {
            username: username.toLowerCase(),
          },
          service.userProfileFields + ' roles public blocked',
        )
          .populate({
            path: 'member.tribe',
            select: tribesHandler.tribeFields,
            model: 'Tribe',
            // Not possible at the moment due bug in Mongoose
            // http://mongoosejs.com/docs/faq.html#populate_sort_order
            // https://github.com/Automattic/mongoose/issues/2202
            // options: { sort: { count: -1 } }
          })
          .exec(function (err, profile) {
            if (err || !profile) {
              // No such user
              return res.status(404).send({
                message: errorService.getErrorMessageByKey('not-found'),
              });
            }
            const { isAdmin, isOwnProfile, isBannedProfile, isBlocked } =
              classifyPermission(authenticatedUser, profile);

            // Not own profile, and not public, or suspended, or shadowbanned user
            if (
              !isAdmin &&
              !isOwnProfile &&
              (!profile.public || isBannedProfile || isBlocked)
            ) {
              return res.status(404).send({
                message: errorService.getErrorMessageByKey('not-found'),
              });
            }
            done(err, profile);
          });
      },
      // Sanitize profile
      function (
        profile: UserServerDocument,
        done: (error: Error | null, profile: UserServerDocument) => void,
      ) {
        req.profile = service.sanitizeProfile(profile, authenticatedUser);
        return done(null, profile);
      },
      // Read User's reply statistics and add them to req.profile
      // We need to add it to req.profile, because profile is mongoose object and
      // adding properties to it doesn't work
      function (
        profile: UserServerDocument,
        done: (error?: Error | null) => void,
      ) {
        // find the statistics
        messageStatService.readFormattedMessageStatsOfUser(
          profile._id,
          Date.now(),
          function (
            err: Error | null,
            stats?: { replyRate?: string; replyTime?: string },
          ) {
            // If we receive error, let's just continue.
            // The stats are non-essential.
            if (!err) {
              // add replyRate and replyTime to req.profile
              _.assign(req.profile, _.pick(stats!, ['replyRate', 'replyTime']));
            }
            return done();
          },
        );
      },
      // Next Route
      function () {
        next();
      },
    ],
    function (err?: Error | null) {
      if (err) return next(err);
    },
  );
};

/**
 * Has 3 months passed since user changed their username OR signed up?
 *
 * @return {Bool}
 */
function isUsernameUpdateAllowed(
  user: Pick<UserServerRecord, 'usernameUpdated' | 'created'>,
) {
  const allowedDate = moment(user.usernameUpdated || user.created).add(
    3,
    'months',
  );
  return moment().isSameOrAfter(allowedDate);
}

// Some responses sanitize another member's public profile, while authenticated
// user responses need own-account fields such as usernameUpdateAllowed.
function sameUser(
  profile: UserServerDocument | ProfilePayload | null | undefined,
  authenticatedUser: UserServerDocument | null | undefined,
): boolean {
  if (
    !profile ||
    !authenticatedUser ||
    !profile._id ||
    !authenticatedUser._id
  ) {
    return false;
  }
  if (authenticatedUser._id.equals) {
    return authenticatedUser._id.equals(profile._id);
  }
  return authenticatedUser._id.toString() === profile._id.toString();
}
function sanitizeProfile(
  profile: UserServerDocument | null | undefined,
  isOwnProfile: true,
  authenticatedUser: UserServerDocument | null | undefined,
):
  | import('../../shared/profile.js').OwnProfile<mongoose.Types.ObjectId, Date>
  | undefined;
function sanitizeProfile(
  profile: UserServerDocument | null | undefined,
  isOwnProfile: false,
  authenticatedUser: UserServerDocument | null | undefined,
):
  | import('../../shared/profile.js').PublicProfile<
      mongoose.Types.ObjectId,
      Date
    >
  | undefined;
function sanitizeProfile(
  profile: UserServerDocument | null | undefined,
  isOwnProfile: boolean,
  authenticatedUser: UserServerDocument | null | undefined,
): ProfilePayload | undefined;
function sanitizeProfile(
  profileDocument: UserServerDocument | null | undefined,
  isOwnProfile: boolean,
  authenticatedUser: UserServerDocument | null | undefined,
): ProfilePayload | undefined {
  if (!profileDocument) {
    return;
  }

  // Destruct Mongoose object to regular object so that we can manipulate it
  const profile =
    profileDocument.toObject() as unknown as import('./users.profile.server.contracts.mts').SanitizedProfileRecord;
  const authenticatedRoles = authenticatedUser?.roles || [];
  const hideExternalContactDetails =
    !isOwnProfile &&
    authenticatedRoles.includes('shadowban') &&
    !authenticatedRoles.includes('admin');

  // We're sanitizing this already on saving/updating the profile, but here we do it again just in case.
  if (profile.description) {
    profile.description = sanitizeHtml(
      profile.description,
      textService.sanitizeOptions,
    );
    if (hideExternalContactDetails) {
      profile.description = textService.stripContactDetails(
        profile.description,
      );
    }
  }

  // Remove tribes without reference object (= they've been deleted from `tribes` table)
  if (profile.member && profile.member.length > 0) {
    profile.member = _.reject(profile.member, function (o) {
      return !o.tribe;
    });
  }

  // Create simple arrays of tribe id's
  profile.memberIds = [];
  if (profile.member && profile.member.length > 0) {
    profile.member.forEach(function (obj) {
      const tribe = obj.tribe!;
      const tribeId = (tribe as { _id?: mongoose.Types.ObjectId })._id || tribe;
      profile.memberIds!.push(tribeId.toString());
    });
  }
  if (isOwnProfile) {
    // Is user allowed to update their username?
    profile.usernameUpdateAllowed = isUsernameUpdateAllowed(profile);
  } else {
    // Remove data we don't need from other member's profile
    delete profile.updated;
    delete profile.passwordUpdated;
    delete profile.usernameUpdated;
  }

  profile.isGreeter = profile.roles!.includes('welcome-team');

  // Volunteer status
  if (profile.roles!.includes('volunteer-alumni')) {
    profile.isVolunteerAlumni = true;
  } else if (profile.roles!.includes('volunteer')) {
    profile.isVolunteer = true;
  }

  // This info totally shouldn't be at the frontend
  //
  // - They're not included on `service.userProfileFields`,
  //   but this is an additional layer of security
  //
  // - This step is required by `core.server.controller.js `
  //   as it would otherwise send authenticated user's profile "as is"
  delete profile.resetPasswordToken;
  delete profile.resetPasswordExpires;
  delete profile.removeProfileToken;
  delete profile.removeProfileExpires;
  delete profile.emailToken;
  delete profile.emailTokenIssuedAt;
  delete profile.emailTokenExpires;
  delete profile.password;
  delete profile.salt;
  delete profile.roles;

  // Legacy social connections are still shown so members can remove them.
  // Only the identifiers needed for those rows and existing public links may
  // reach the client; provider payloads can also contain credentials and PII.
  if (hideExternalContactDetails) {
    delete profile.additionalProvidersData;
    delete profile.extSitesBW;
    delete profile.extSitesCS;
    delete profile.extSitesCouchers;
    delete profile.extSitesWS;
    delete profile.nostrNpub;
  } else if (_.isObject(profile.additionalProvidersData)) {
    const providerIdentityFields = {
      facebook: ['id'],
      github: ['login'],
      twitter: ['screen_name'],
    };
    const sanitizedProviders: Record<string, unknown> = {};
    _.forEach(providerIdentityFields, function (fields, provider) {
      if (_.has(profile.additionalProvidersData, provider)) {
        sanitizedProviders[provider] = _.pick(
          profile.additionalProvidersData[provider],
          fields,
        );
      }
    });
    profile.additionalProvidersData = sanitizedProviders;
  }

  // This information is not sensitive, but isn't needed at frontend
  delete profile.publicReminderCount;
  delete profile.publicReminderSent;
  delete profile.welcomeSequenceStep;
  delete profile.welcomeSequenceSent;

  // Hide Mongoose document revision aka `versionKey`
  // http://mongoosejs.com/docs/guide.html#versionKey
  // http://aaronheckmann.tumblr.com/post/48943525537/mongoose-v3-part-1-versioning
  delete profile.__v;
  return selectProfileResponse(profile, isOwnProfile);
}

/**
 * Sanitize profile before sending it to frontend
 * - Ensures certain fields are removed before publishing
 * - Collects tribe id's into one simple array
 * - Removes tribe references that don't exist anymore (i.e. they are removed from `tribes` table but reference ID remains in the user's table)
 * - Sanitize description in case
 *
 * @param {Object} profile - User profile to sanitize
 * @param {Object} authenticatedUser - Currently authenticated user profile. Allows some fields if this matches to `profile`
 * @return {Object} Sanitized profile.
 */
service.sanitizeProfile = function (
  profile: UserServerDocument | null | undefined,
  authenticatedUser?: UserServerDocument | null,
) {
  return sanitizeProfile(
    profile,
    sameUser(profile, authenticatedUser),
    authenticatedUser,
  );
};
service.sanitizeOwnProfile = function (
  profile: UserServerDocument | null | undefined,
) {
  return sanitizeProfile(profile, true, profile);
};

/**
 * Join tribe
 */
service.joinTribe = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  const authenticatedUser = req.user;
  const tribeId = req.params.tribeId;

  // Not a valid ObjectId
  if (!tribeId || !mongoose.Types.ObjectId.isValid(tribeId)) {
    return errorService.sendInvalidId(res);
  }
  async.waterfall(
    [
      // Check user is a member of this tribe
      function (done: ErrorDone) {
        // Return if user is already a member
        if (isUserMemberOfTribe(authenticatedUser, tribeId)) {
          return res.status(409).send({
            message: 'You are already a member of this tribe.',
          });
        }
        done(null);
      },
      // Update tribe counter
      function (
        done: (error: Error | null, tribe: PopulatedTribeDocument) => void,
      ) {
        tribesHandler.updateCount(
          tribeId,
          1,
          true,
          function (err: Error | null, tribe?: TribeCountResult | null) {
            // Tribe by id `req.body.id` didn't exist
            if (!hasTribeId(tribe)) {
              return res.status(400).send({
                message: errorService.getErrorMessageByKey('bad-request'),
              });
            }
            done(err, tribe);
          },
        );
      },
      // Add tribe to user's object
      function (
        tribe: PopulatedTribeDocument,
        done: (
          error: Error | null,
          tribe: PopulatedTribeDocument,
          user: UserServerDocument | null,
        ) => void,
      ) {
        User.findByIdAndUpdate(
          authenticatedUser._id,
          {
            $push: {
              member: {
                tribe: tribe._id,
                since: Date.now(),
              },
            },
          },
          {
            safe: true,
            // @link http://stackoverflow.com/a/4975054/1984644
            new: true, // get the updated document in return
          },
        ).exec(function (err, user) {
          done(err, tribe, user);
        });
      },
      // Done, output new tribe + user objects
      function (
        tribe: PopulatedTribeDocument,
        user: UserServerDocument | null,
        done: ErrorDone,
      ) {
        // Preserver only public fields
        // Array of keys to preserve in tribe before sending it to the frontend
        const pickedTribe = _.pick(tribe, tribesHandler.tribeFields.split(' '));

        // Sanitize user profile
        const sanitizedUser = service.sanitizeProfile(user, authenticatedUser);
        statService.stat(
          {
            namespace: 'tagAction',
            counts: {
              count: 1,
            },
            tags: {
              type: 'tribe',
            },
            meta: {
              slug: tribe.slug,
            },
          },
          function () {
            // Send response to API
            res.send({
              message: 'Joined tribe.',
              tribe: pickedTribe,
              user: sanitizedUser,
            });
            done();
          },
        );
      },

      // Catch errors
    ],
    function (err?: Error | null) {
      if (err) {
        return res.status(400).send({
          message: 'Failed to join tribe.',
        });
      }
    },
  );
};

/**
 * Leave tribe
 */
service.leaveTribe = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  const authenticatedUser = req.user;
  const tribeId = req.params.tribeId;

  // Not a valid ObjectId
  if (!tribeId || !mongoose.Types.ObjectId.isValid(tribeId)) {
    return errorService.sendInvalidId(res);
  }
  async.waterfall(
    [
      // Check user is a member of this tribe
      function (done: ErrorDone) {
        // Return if isn't a member anymore
        if (!isUserMemberOfTribe(authenticatedUser, tribeId)) {
          return res.status(409).send({
            message: 'You are not a member of this tribe.',
          });
        }
        done(null);
      },
      // Update tribe counter
      function (
        done: (error: Error | null, tribe: PopulatedTribeDocument) => void,
      ) {
        tribesHandler.updateCount(
          tribeId,
          -1,
          true,
          function (err: Error | null, tribe?: TribeCountResult | null) {
            // Tribe by id `req.body.id` didn't exist
            if (!hasTribeId(tribe)) {
              return res.status(400).send({
                message: errorService.getErrorMessageByKey('bad-request'),
              });
            }
            done(err, tribe);
          },
        );
      },
      // Remove tribe from user's object
      function (
        tribe: PopulatedTribeDocument,
        done: (
          error: Error | null,
          tribe: PopulatedTribeDocument,
          user: UserServerDocument | null,
        ) => void,
      ) {
        User.findByIdAndUpdate(
          authenticatedUser._id,
          {
            $pull: {
              member: {
                tribe: tribeId,
              },
            },
          },
          {
            safe: true,
            // @link http://stackoverflow.com/a/4975054/1984644
            new: true, // get the updated document in return
          },
        ).exec(function (err, user) {
          done(err, tribe, user);
        });
      },
      // Done, output new tribe + user objects
      function (
        tribe: PopulatedTribeDocument,
        user: UserServerDocument | null,
        done: ErrorDone,
      ) {
        // Preserver only public fields
        // Array of keys to preserve in tribe before sending it to the frontend
        const pickedTribe = _.pick(tribe, tribesHandler.tribeFields.split(' '));

        // Sanitize user profile
        const sanitizedUser = service.sanitizeProfile(user, authenticatedUser);
        statService.stat(
          {
            namespace: 'tagAction',
            counts: {
              count: -1,
            },
            tags: {
              type: 'tribe',
            },
            meta: {
              slug: tribe.slug,
            },
          },
          function () {
            // Send response to API
            res.send({
              message: 'Left tribe.',
              tribe: pickedTribe,
              user: sanitizedUser,
            });
            done();
          },
        );
      },

      // Catch errors
    ],
    function (err?: Error | null) {
      if (err) {
        return res.status(400).send({
          message: 'Failed to leave tribe.',
        });
      }
    },
  );
};

/**
 * Get user's tribes
 */
service.getUserMemberships = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  User.findById(req.user._id, 'member')
    .populate({
      path: 'member.tribe',
      select: tribesHandler.tribeFields,
      model: 'Tribe',
      // Not possible at the moment due bug in Mongoose
      // http://mongoosejs.com/docs/faq.html#populate_sort_order
      // https://github.com/Automattic/mongoose/issues/2202
      // options: { sort: { count: -1 } }
    })
    .exec(function (err: Error | null, profile: UserServerDocument | null) {
      // Something went wrong
      if (err) {
        return res.status(400).send({
          message: 'Failed to get list of tribes.',
        });
      }
      return res.send(profile!.member || []);
    });
};

/**
 * Remove push registration
 */
service.removePushRegistration = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  const user = req.user;
  const token = req.params.token;
  const query = {
    $pull: {
      pushRegistration: {
        token,
      },
    },
  };
  User.findByIdAndUpdate(user._id, query, {
    safe: true,
    // @link http://stackoverflow.com/a/4975054/1984644
    new: true, // get the updated document in return
  }).exec(function (err: Error | null, user: UserServerDocument | null) {
    if (err) {
      return res.status(400).send({
        message:
          errorService.getErrorMessage(err) ||
          'Failed to remove registration, please try again.',
      });
    } else {
      return res.send({
        message: 'Removed registration.',
        user: service.sanitizeOwnProfile(user),
      });
    }
  });
};

/**
 * Add push registration
 *
 * Push delivery is retired. Keep this endpoint as a deliberate rejection so
 * older clients fail clearly. Reintroduce registration here if push returns.
 * Historical tokens remain removable via `removePushRegistration`.
 */
service.addPushRegistration = function (req, res) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }
  return res.status(400).send({
    message: 'Push notifications are no longer available.',
  });
};

/**
 * Is user member of tribe?
 *
 * @param object user User
 * @param String tribeId Tribe ID
 * @return boolean
 */
function isUserMemberOfTribe(
  user: UserServerDocument,
  tribeId: string,
): boolean {
  if (!user.member || !user.member.length) {
    return false;
  }

  // `_.find` iterates over elements of collection, returning the first element
  // predicate returns truthy for. Otherwise returns undefined.
  return Boolean(
    _.find(user.member, function (membership) {
      return membership.tribe.equals(tribeId);
    }),
  );
}

/*
 * This middleware sends response with an array of found users
 * We assume that req.query.search exists
 */
service.search = function (req, res, next) {
  // check that the search string is provided
  if (!_.has(req.query, 'search')) {
    return next();
  }

  // validate the query string
  if (
    typeof req.query.search !== 'string' ||
    req.query.search.trim().length < 3 ||
    req.query.search.length > 120
  ) {
    const errorMessage = errorService.getErrorMessageByKey('bad-request');
    return res.status(400).send({
      message: errorMessage,
      detail: 'Query string should contain between 3 and 120 characters.',
    });
  }
  if (req.skip > 1000) {
    return res.status(400).send({
      message:
        'Please refine your member search instead of requesting more pages.',
    });
  }
  const blocked = req.user!.blocked || [];
  // perform the search
  User.find(
    {
      $and: [
        {
          public: true,
        },
        // only public users
        {
          _id: {
            $nin: blocked,
          },
        },
        // remove ones that I blocked
        {
          roles: {
            $nin: ['suspended', 'shadowban'],
          },
        },
        {
          $text: {
            $search: req.query.search.trim(),
          },
        },
      ],
    },
    {
      score: {
        $meta: 'textScore',
      },
    },
  )
    // select only the right profile properties
    .select(service.userSearchProfileFields + ' blocked')
    .sort({
      score: {
        $meta: 'textScore',
      },
    })
    // limit the amount of found users
    .limit(
      Math.min(
        (req.query.limit || config.limits.paginationLimit) as number,
        50,
      ),
    )
    // skip to the page, automatically handles invalid page number
    .skip(req.skip)
    .maxTimeMS(2000)
    .exec(function (err, users) {
      if (err) return next(err);
      /** filter ones that have blocked me */
      const filterFnc = createBlockingUserFilter(req.user!);
      return res.send(filterFnc(users));
    });
};
const defaultExport = service;
export default defaultExport;
export const addPushRegistration = defaultExport.addPushRegistration;
export const cancelEmailChange = defaultExport.cancelEmailChange;
export const changeEmail = defaultExport.changeEmail;
export const getMiniUser = defaultExport.getMiniUser;
export const getUser = defaultExport.getUser;
export const getUserMemberships = defaultExport.getUserMemberships;
export const initializeRemoveProfile = defaultExport.initializeRemoveProfile;
export const joinTribe = defaultExport.joinTribe;
export const leaveTribe = defaultExport.leaveTribe;
export const removeProfile = defaultExport.removeProfile;
export const removePushRegistration = defaultExport.removePushRegistration;
export const sanitizeOwnProfile = defaultExport.sanitizeOwnProfile;
const __exportedSanitizeProfile = defaultExport.sanitizeProfile;
export { __exportedSanitizeProfile as sanitizeProfile };
export const search = defaultExport.search;
export const update = defaultExport.update;
export const userByUsername = defaultExport.userByUsername;
export const userListingProfileFields = defaultExport.userListingProfileFields;
export const userMiniByID = defaultExport.userMiniByID;
export const userMiniProfileFields = defaultExport.userMiniProfileFields;
export const userProfileFields = defaultExport.userProfileFields;
export const userSearchProfileFields = defaultExport.userSearchProfileFields;
export { defaultExport as 'module.exports' };
