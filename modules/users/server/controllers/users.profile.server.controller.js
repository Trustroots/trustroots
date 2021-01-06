/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const locales = require(path.resolve('./config/shared/locales'));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const tribesHandler = require(path.resolve(
  './modules/tribes/server/controllers/tribes.server.controller',
));
const contactHandler = require(path.resolve(
  './modules/contacts/server/controllers/contacts.server.controller',
));
const messageHandler = require(path.resolve(
  './modules/messages/server/controllers/messages.server.controller',
));
const offerHandler = require(path.resolve(
  './modules/offers/server/controllers/offers.server.controller',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const pushService = require(path.resolve(
  './modules/core/server/services/push.server.service',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const log = require(path.resolve('./config/lib/logger'));
const del = require('del');
const messageStatService = require(path.resolve(
  './modules/messages/server/services/message-stat.server.service',
));
const config = require(path.resolve('./config/config'));
const async = require('async');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');
const moment = require('moment');
const User = mongoose.model('User');

// Fields to send publicly about any user profile
// to make sure we're not sending unsecure content (eg. passwords)
// Pick here fields to send
exports.userProfileFields = [
  'id',
  'displayName',
  'username',
  'gender',
  'tagline',
  'description',
  'locationFrom',
  'locationLiving',
  'languages',
  'birthdate',
  'seen',
  'created',
  'updated',
  'passwordUpdated',
  'avatarSource',
  'avatarUploaded',
  'member',
  'replyRate',
  'replyTime',
  'extSitesBW', // BeWelcome username
  'extSitesCS', // CouchSurfing username
  'extSitesWS', // WarmShowers username
  'emailHash', // MD5 hashed email to use with Gravatars
  'additionalProvidersData.facebook.id', // For FB avatars and profile links
  'additionalProvidersData.twitter.screen_name', // For Twitter profile links
  'additionalProvidersData.github.login', // For GitHub profile links
].join(' ');

// Restricted set of profile fields when only really "miniprofile" is needed
exports.userMiniProfileFields = [
  'id',
  'updated', // Used as local-avatar cache buster
  'displayName',
  'username',
  'avatarSource',
  'avatarUploaded',
  'emailHash',
  'additionalProvidersData.facebook.id', // For FB avatars
].join(' ');

// Mini + a few fields we'll need at listings
exports.userListingProfileFields =
  exports.userMiniProfileFields + ' member birthdate gender tagline';
exports.userSearchProfileFields =
  exports.userMiniProfileFields + ' gender locationFrom locationLiving';

/**
 * Update user profile
 */
exports.update = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
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
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('bad-request'),
    });
  }

  async.waterfall(
    [
      function (done) {
        // Email didn't change, just continue
        if (!req.body.email || req.body.email === req.user.email) {
          return done();
        }

        // User is changing email, check if it's available
        User.findOne(
          {
            $or: [
              { emailTemporary: req.body.email.toLowerCase() },
              { email: req.body.email.toLowerCase() },
            ],
          },
          'emailTemporary email',
          function (err, emailUser) {
            // Not available
            if (emailUser) {
              // If the user we found with this email is currently authenticated user,
              // let user pass to resend confirmation email
              if (emailUser._id.equals(req.user._id)) {
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

      // Check if we should generate new email token
      function (done) {
        // Generate only if email changed
        if (req.body.email && req.body.email !== req.user.email) {
          crypto.randomBytes(20, function (err, buffer) {
            const token = buffer.toString('hex');
            done(err, token, req.body.email);
          });
        } else {
          // Email didn't change, just continue
          done(null, false, false);
        }
      },

      // User wants to change the username
      function (token, email, done) {
        if (req.body.username && req.body.username !== req.user.username) {
          // They are not allowed to do so
          if (!isUsernameUpdateAllowed(req.user)) {
            return res.status(403).send({
              message: 'You cannot change your username at this time.',
            });
          }

          // Mark username updated
          req.user.usernameUpdated = new Date();
        }

        done(null, token, email);
      },

      // Update user
      function (token, email, done) {
        // For security measurement do not use _id from the req.body object
        delete req.body._id;

        // For security measurement remove these from the req.body object
        // Users aren't allowed to modify these directly
        delete req.body.member;
        delete req.body.public;
        delete req.body.created;
        delete req.body.seen;
        delete req.body.passwordUpdated;
        delete req.body.roles;
        delete req.body.email;
        delete req.body.emailHash;
        delete req.body.emailToken;
        delete req.body.emailTemporary;
        delete req.body.provider;
        delete req.body.usernameUpdated;
        delete req.body.salt;
        delete req.body.password;
        delete req.body.resetPasswordToken;
        delete req.body.resetPasswordExpires;
        delete req.body.removeProfileToken;
        delete req.body.removeProfileExpires;
        delete req.body.additionalProvidersData;
        delete req.body.publicReminderCount;
        delete req.body.publicReminderSent;
        delete req.body.welcomeSequenceStep;
        delete req.body.welcomeSequenceSent;
        delete req.body.acquisitionStory;

        // Merge existing user
        let user = req.user;
        user = _.extend(user, req.body);
        user.updated = Date.now();

        // This is set only if user edited email
        if (token && email) {
          user.emailToken = token;
          user.emailTemporary = email;
        }

        user.save(function (err) {
          if (!err) {
            req.login(user, function (err) {
              if (err) {
                done(err);
              } else {
                done(null, token, user);
              }
            });
          } else {
            done(err, token, user);
          }
        });
      },

      // Send email
      function (token, user, done) {
        if (token) {
          emailService.sendChangeEmailConfirmation(user, function (err) {
            done(err, user);
          });
        } else {
          done(null, user);
        }
      },

      // Return user
      function (user) {
        user = exports.sanitizeProfile(user, req.user);
        return res.json(user);
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Initialize profile removal
 */
exports.initializeRemoveProfile = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

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
      function (done) {
        crypto.randomBytes(20, function (err, buffer) {
          const token = buffer.toString('hex');
          done(err, token);
        });
      },

      // Set token
      function (token, done) {
        // Token expires in 24 hours
        const tokenExpires = Date.now() + 24 * 3600000;

        User.findOneAndUpdate(
          { _id: req.user._id },
          {
            $set: {
              removeProfileToken: token,
              removeProfileExpires: tokenExpires,
            },
          },
          {
            // Return updated user document
            new: true,
          },
          function (err, user) {
            done(err, user);
          },
        );
      },

      // Send email
      function (user) {
        emailService.sendRemoveProfile(user, function (err) {
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
    function (err) {
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
exports.removeProfile = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  async.waterfall(
    [
      // Validate token
      function (done) {
        User.findOne(
          {
            _id: req.user._id,
            removeProfileToken: req.params.token,
            removeProfileExpires: {
              $gt: Date.now(),
            },
          },
          function (err, user) {
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
      function (user, done) {
        User.findOneAndRemove(
          {
            _id: user._id,
          },
          function (err) {
            done(err, user);
          },
        );
      },

      // Remove offers
      function (user, done) {
        offerHandler.removeAllByUserId(user._id, function (err) {
          if (err) {
            log('error', 'Error when removing all offers by user ID. #rj393', {
              error: err,
            });
          }
          done(null, user);
        });
      },

      // Remove contacts
      function (user, done) {
        contactHandler.removeAllByUserId(user._id, function (err) {
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
      function (user, done) {
        messageHandler.markAllMessagesToUserNotified(user._id, function (err) {
          return done(err, user);
        });
      },

      // Subtract 1 from all the tribes.count of which user is member
      function (user, done) {
        async.each(
          user.member,
          function (membership, callback) {
            // Update the count of every tribe user is member of
            tribesHandler.updateCount(membership.tribe, -1, false, callback);
          },
          function (err) {
            done(err, user);
          },
        );
      },

      // Remove uploaded images
      function (user, done) {
        // All user's uploads are under their own folder
        del(path.resolve(config.uploadDir) + '/' + user._id).then(function () {
          done(null, user);
        });
      },

      // Send email
      function (user, done) {
        emailService.sendRemoveProfileConfirmed(
          {
            displayName: user.displayName,
            email: user.email,
          },
          function (err) {
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
    function (err) {
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
exports.getUser = function (req, res) {
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
exports.getMiniUser = function (req, res) {
  if (req.profile) {
    const profile = req.profile.toObject();

    // 'public' isn't needed at frontend.
    // We had to bring it until here trough
    // ACL policy since it's needed there.
    delete profile.public;

    // 'roles' isn't needed at frontend.
    // We had to bring it until here trough
    // checks in `userMiniByID`
    delete profile.roles;

    return res.json(profile);
  }

  res.json({});
};

function classifyPermission(user, profile) {
  const isOwnProfile = user._id.equals(profile._id);
  const isBannedProfile =
    profile.roles.includes('suspended') || profile.roles.includes('shadowban');
  const isAdminOrModerator =
    user.roles.includes('moderator') || user.roles.includes('admin');
  const isBlocked = !!profile.blocked && profile.blocked.indexOf(user._id) >= 0;
  const hasBlocked = !!user.blocked && user.blocked.indexOf(profile._id) >= 0;
  return {
    isOwnProfile,
    isBannedProfile,
    isAdminOrModerator,
    isBlocked,
    hasBlocked,
  };
}

/** Filter out users that has blocked the logged */
function createBlockingUserFilter(loggedUser) {
  /** check if blocked, a bit tricky because are mongoose ObjectID */
  const isBlocked = blockedList =>
    !!blockedList && blockedList.some(blc => blc.equals(loggedUser.id));
  return users => {
    const res = [];
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
exports.userMiniByID = function (req, res, next, userId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  User.findById(
    userId,
    exports.userMiniProfileFields + ' public roles blocked',
  ).exec(function (err, profile) {
    // Something went wrong or no profile
    if (err || !profile) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }
    const {
      isAdminOrModerator,
      isOwnProfile,
      isBannedProfile,
      isBlocked,
      hasBlocked,
    } = classifyPermission(req.user, profile);
    // Not own profile, and not public, or suspended, or shadowbanned user
    if (
      !isAdminOrModerator &&
      !isOwnProfile &&
      (!profile.public || isBannedProfile || isBlocked || hasBlocked)
    ) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    req.profile = profile;
    next();
  });
};

/**
 * Profile middleware
 */
exports.userByUsername = function (req, res, next, username) {
  // Require user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

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
      function (done) {
        User.findOne(
          {
            username: username.toLowerCase(),
          },
          exports.userProfileFields + ' roles public blocked',
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

            const {
              isAdminOrModerator,
              isOwnProfile,
              isBannedProfile,
              isBlocked,
            } = classifyPermission(req.user, profile);

            // Not own profile, and not public, or suspended, or shadowbanned user
            if (
              !isAdminOrModerator &&
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
      function (profile, done) {
        req.profile = exports.sanitizeProfile(profile, req.user);
        return done(null, profile);
      },

      // Read User's reply statistics and add them to req.profile
      // We need to add it to req.profile, because profile is mongoose object and
      // adding properties to it doesn't work
      function (profile, done) {
        // find the statistics
        messageStatService.readFormattedMessageStatsOfUser(
          profile._id,
          Date.now(),
          function (err, stats) {
            // If we receive error, let's just continue.
            // The stats are non-essential.
            if (!err) {
              // add replyRate and replyTime to req.profile
              _.assign(req.profile, _.pick(stats, ['replyRate', 'replyTime']));
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
    function (err) {
      if (err) return next(err);
    },
  );
};

/**
 * Has 3 months passed since user changed their username OR signed up?
 *
 * @return {Bool}
 */
function isUsernameUpdateAllowed(user) {
  const allowedDate = moment(user.usernameUpdated || user.created).add(
    3,
    'months',
  );
  return moment().isSameOrAfter(allowedDate);
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
exports.sanitizeProfile = function (profile, authenticatedUser) {
  if (!profile) {
    return;
  }

  // Destruct Mongoose object to regular object so that we can manipulate it
  profile = profile.toObject();

  // We're sanitizing this already on saving/updating the profile, but here we do it again just in case.
  if (profile.description)
    profile.description = sanitizeHtml(
      profile.description,
      textService.sanitizeOptions,
    );

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
      // If profile's `member.tribe` path was populated
      if (obj.tribe && obj.tribe._id) {
        profile.memberIds.push(obj.tribe._id.toString());
      } else if (obj.tribe) {
        // If profile's `member.tribe` path wasn't populated, tribe is ObjectId
        profile.memberIds.push(obj.tribe.toString());
      }
    });
  }

  const isOwnProfile =
    authenticatedUser && authenticatedUser._id.equals(profile._id);

  if (isOwnProfile) {
    // Is user allowed to update their username?
    profile.usernameUpdateAllowed = isUsernameUpdateAllowed(profile);
  } else {
    // Remove data we don't need from other member's profile
    delete profile.updated;
    delete profile.passwordUpdated;
    delete profile.usernameUpdated;
  }

  // Volunteer status
  if (profile.roles.includes('volunteer-alumni')) {
    profile.isVolunteerAlumni = true;
  } else if (profile.roles.includes('volunteer')) {
    profile.isVolunteer = true;
  }

  // This info totally shouldn't be at the frontend
  //
  // - They're not included on `exports.userProfileFields`,
  //   but this is an additional layer of security
  //
  // - This step is required by `core.server.controller.js `
  //   as it would otherwise send authenticated user's profile "as is"
  delete profile.resetPasswordToken;
  delete profile.resetPasswordExpires;
  delete profile.removeProfileToken;
  delete profile.removeProfileExpires;
  delete profile.emailToken;
  delete profile.password;
  delete profile.salt;
  delete profile.roles;

  // This information is not sensitive, but isn't needed at frontend
  delete profile.publicReminderCount;
  delete profile.publicReminderSent;
  delete profile.welcomeSequenceStep;
  delete profile.welcomeSequenceSent;

  // Hide Mongoose document revision aka `versionKey`
  // http://mongoosejs.com/docs/guide.html#versionKey
  // http://aaronheckmann.tumblr.com/post/48943525537/mongoose-v3-part-1-versioning
  delete profile.__v;

  return profile;
};

/**
 * Join tribe
 */
exports.joinTribe = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  const tribeId = req.params.tribeId;

  // Not a valid ObjectId
  if (!tribeId || !mongoose.Types.ObjectId.isValid(tribeId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  async.waterfall(
    [
      // Check user is a member of this tribe
      function (done) {
        // Return if user is already a member
        if (isUserMemberOfTribe(req.user, tribeId)) {
          return res.status(409).send({
            message: 'You are already a member of this tribe.',
          });
        }

        done(null);
      },

      // Update tribe counter
      function (done) {
        tribesHandler.updateCount(tribeId, 1, true, function (err, tribe) {
          // Tribe by id `req.body.id` didn't exist
          if (!tribe || !tribe._id) {
            return res.status(400).send({
              message: errorService.getErrorMessageByKey('bad-request'),
            });
          }

          done(err, tribe);
        });
      },

      // Add tribe to user's object
      function (tribe, done) {
        User.findByIdAndUpdate(
          req.user._id,
          {
            $push: {
              member: {
                tribe: tribe._id,
                since: Date.now(),
              },
            },
          },
          {
            safe: true, // @link http://stackoverflow.com/a/4975054/1984644
            new: true, // get the updated document in return
          },
        ).exec(function (err, user) {
          done(err, tribe, user);
        });
      },

      // Done, output new tribe + user objects
      function (tribe, user, done) {
        // Preserver only public fields
        // Array of keys to preserve in tribe before sending it to the frontend
        const pickedTribe = _.pick(tribe, tribesHandler.tribeFields.split(' '));

        // Sanitize user profile
        user = exports.sanitizeProfile(user, req.user);

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
              user,
            });

            done();
          },
        );
      },

      // Catch errors
    ],
    function (err) {
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
exports.leaveTribe = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  const tribeId = req.params.tribeId;

  // Not a valid ObjectId
  if (!tribeId || !mongoose.Types.ObjectId.isValid(tribeId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  async.waterfall(
    [
      // Check user is a member of this tribe
      function (done) {
        // Return if isn't a member anymore
        if (!isUserMemberOfTribe(req.user, tribeId)) {
          return res.status(409).send({
            message: 'You are not a member of this tribe.',
          });
        }

        done(null);
      },

      // Update tribe counter
      function (done) {
        tribesHandler.updateCount(tribeId, -1, true, function (err, tribe) {
          // Tribe by id `req.body.id` didn't exist
          if (!tribe || !tribe._id) {
            return res.status(400).send({
              message: errorService.getErrorMessageByKey('bad-request'),
            });
          }

          done(err, tribe);
        });
      },

      // Remove tribe from user's object
      function (tribe, done) {
        User.findByIdAndUpdate(
          req.user._id,
          {
            $pull: {
              member: {
                tribe: tribeId,
              },
            },
          },
          {
            safe: true, // @link http://stackoverflow.com/a/4975054/1984644
            new: true, // get the updated document in return
          },
        ).exec(function (err, user) {
          done(err, tribe, user);
        });
      },

      // Done, output new tribe + user objects
      function (tribe, user, done) {
        // Preserver only public fields
        // Array of keys to preserve in tribe before sending it to the frontend
        const pickedTribe = _.pick(tribe, tribesHandler.tribeFields.split(' '));

        // Sanitize user profile
        user = exports.sanitizeProfile(user, req.user);

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
              user,
            });

            done();
          },
        );
      },

      // Catch errors
    ],
    function (err) {
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
exports.getUserMemberships = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
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
    .exec(function (err, profile) {
      // Something went wrong
      if (err) {
        return res.status(400).send({
          message: 'Failed to get list of tribes.',
        });
      }

      return res.send(profile.member || []);
    });
};

/**
 * Remove push registration
 */
exports.removePushRegistration = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
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
    safe: true, // @link http://stackoverflow.com/a/4975054/1984644
    new: true, // get the updated document in return
  }).exec(function (err, user) {
    if (err) {
      return res.status(400).send({
        message:
          errorService.getErrorMessage(err) ||
          'Failed to remove registration, please try again.',
      });
    } else {
      return res.send({
        message: 'Removed registration.',
        user: exports.sanitizeProfile(user, user),
      });
    }
  });
};

/**
 * Add push registration
 */
exports.addPushRegistration = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  let user = req.user;
  const token = String(_.get(req, 'body.token', ''));
  const platform = String(_.get(req, 'body.platform', ''));
  const deviceId = String(_.get(req, 'body.deviceId', ''));
  const doNotNotify = Boolean(_.get(req, 'body.doNotNotify', false));

  if (!token) {
    return res.status(400).send({
      message: 'Token is invalid or missing.',
    });
  }

  // PushRegistration is a sub-schema at User schema, thus we need to dig deeper in to get `enumValues`
  // Will contain array of string values, e.g. `['android', 'ios', 'web']`
  const validPlatforms =
    User.schema.path('pushRegistration').schema.path('platform').enumValues ||
    [];

  if (!platform || validPlatforms.indexOf(platform) === -1) {
    return res.status(400).send({
      message: 'Platform is invalid or missing.',
    });
  }

  async.waterfall(
    [
      // Remove any existing registrations for this token

      function (done) {
        User.findByIdAndUpdate(user._id, {
          $pull: {
            pushRegistration: {
              token,
            },
          },
        }).exec(function (err) {
          done(err);
        });
      },

      // Add new registration

      function (done) {
        const registration = {
          platform,
          token,
          created: Date.now(),
        };

        if (deviceId) {
          registration.deviceId = deviceId;
        }

        User.findByIdAndUpdate(
          user._id,
          {
            $push: {
              pushRegistration: registration,
            },
          },
          {
            new: true,
          },
        ).exec(function (err, updatedUser) {
          if (err) {
            return done(err);
          }
          user = updatedUser;
          done();
        });
      },

      // Notify the user we just added a device

      function (done) {
        // Don't notify if in request we asked to be silent
        if (doNotNotify) {
          return done();
        }

        pushService.notifyPushDeviceAdded(user, platform, function (err) {
          if (err) {
            // don't stop on error, but log it
            log(
              'error',
              'Error when sending push notification about added device. #9hsdff',
              {
                error: err,
              },
            );
          }
          done();
        });
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message:
            errorService.getErrorMessage(err) || 'Failed, please try again.',
        });
      } else {
        User.findById(user._id).exec(function (err, user) {
          if (err) {
            return res.status(400).send({
              message:
                errorService.getErrorMessage(err) ||
                'Failed to fetch user, please try again.',
            });
          }
          return res.send({
            message: 'Saved registration.',
            user: exports.sanitizeProfile(user, user),
          });
        });
      }
    },
  );
};

/**
 * Is user member of tribe?
 *
 * @param object user User
 * @param String tribeId Tribe ID
 * @return boolean
 */
function isUserMemberOfTribe(user, tribeId) {
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
exports.search = function (req, res, next) {
  // check that the search string is provided
  if (!_.has(req.query, 'search')) {
    return next();
  }

  // validate the query string
  if (req.query.search.length < 3) {
    const errorMessage = errorService.getErrorMessageByKey('bad-request');
    return res.status(400).send({
      message: errorMessage,
      detail: 'Query string should be at least 3 characters long.',
    });
  }

  const blocked = req.user.blocked || [];
  // perform the search
  User.find(
    {
      $and: [
        { public: true }, // only public users
        { _id: { $nin: blocked } }, // remove ones that I blocked
        {
          $text: {
            $search: req.query.search,
          },
        },
      ],
    },
    { score: { $meta: 'textScore' } },
  )
    // select only the right profile properties
    .select(exports.userSearchProfileFields + ' blocked')
    .sort({ score: { $meta: 'textScore' } })
    // limit the amount of found users
    .limit(req.query.limit)
    // skip to the page, automatically handles invalid page number
    .skip(req.skip)
    .exec(function (err, users) {
      if (err) return next(err);
      /** filter ones that have blocked me */
      const filterFnc = createBlockingUserFilter(req.user);
      return res.send(filterFnc(users));
    });
};
