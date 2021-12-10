/**
 * Module dependencies.
 */

const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const userProfile = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const sanitizeHtml = require('sanitize-html');
const htmlToText = require('html-to-text');
const async = require('async');
const mongoose = require('mongoose');
const Contact = mongoose.model('Contact');
const User = mongoose.model('User');

/**
 * Add a contact
 */
exports.add = function (req, res) {
  // Defined in this scope so we can remove it in in the case of an error
  let contact;

  async.waterfall(
    [
      // Validate
      function (done) {
        // Not a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.body.friendUserId)) {
          return res.status(400).json({
            message: errorService.getErrorMessageByKey('invalid-id'),
          });
        }

        // Check if contact already exists
        Contact.findOne({
          $or: [
            {
              userTo: req.body.friendUserId,
              userFrom: req.user._id,
            },
            {
              userTo: req.user._id,
              userFrom: req.body.friendUserId,
            },
          ],
        }).exec(function (err, existingContact) {
          if (err) return done(err);

          if (existingContact) {
            // Contact already exists!
            return res.status(409).json({
              message: errorService.getErrorMessageByKey('conflict'),
              confirmed: existingContact.confirmed,
            });
          }

          done();
        });
      },

      // Sanitize message
      function (done) {
        // Catch message separately
        let messageHTML = false;
        let messagePlain = false;
        if (req.body.message && req.body.message !== '') {
          messageHTML = sanitizeHtml(
            req.body.message,
            textService.sanitizeOptions,
          );
          messagePlain = htmlToText.htmlToText(req.body.message, {
            wordwrap: 80,
          });
        }
        delete req.body.message;

        done(null, messageHTML, messagePlain);
      },

      // Create Contact
      function (messageHTML, messagePlain, done) {
        contact = new Contact(req.body);
        contact.confirmed = false;
        contact.userFrom = req.user._id;
        contact.userTo = req.body.friendUserId;

        done(null, messageHTML, messagePlain);
      },

      // Find friend
      function (messageHTML, messagePlain, done) {
        User.findById(req.body.friendUserId, 'email displayName').exec(
          function (err, friend) {
            if (!friend)
              return done(
                new Error('Failed to load user ' + req.body.friendUserId),
              );

            done(err, messageHTML, messagePlain, friend);
          },
        );
      },

      // Save contact
      function (messageHTML, messagePlain, friend, done) {
        contact.save(function (err) {
          done(err, messageHTML, messagePlain, friend);
        });
      },

      // Send email
      function (messageHTML, messagePlain, friend, done) {
        emailService.sendConfirmContact(
          req.user,
          friend,
          contact,
          messageHTML,
          messagePlain,
          function (err) {
            if (err) return done(err);
            return res.send({
              message: 'An email was sent to your contact.',
            });
          },
        );
      },
    ],
    function (err) {
      if (err) {
        if (contact) {
          contact.remove(function () {
            return res.status(400).send({
              message: errorService.getErrorMessage(err),
            });
          });
        } else {
          return res.status(400).send({
            message: errorService.getErrorMessage(err),
          });
        }
      }
    },
  );
};

/**
 * Disconnect contact
 */
exports.remove = function (req, res) {
  const contact = req.contact;

  contact.remove(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err),
      });
    } else {
      res.json(contact);
    }
  });
};

/**
 * Clear all contacts by user id
 */
exports.removeAllByUserId = function (userId, callback) {
  Contact.deleteMany(
    {
      $or: [{ userTo: userId }, { userFrom: userId }],
    },
    function (err) {
      if (callback) {
        callback(err);
      }
    },
  );
};

/**
 * Confirm (i.e. update) contact
 */
exports.confirm = function (req, res) {
  // Only receiving user can confirm user connections
  if (!req.contact || !req.contact.userTo._id.equals(req.user._id.valueOf())) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Ta'da!
  const contact = req.contact;
  contact.confirmed = true;

  contact.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err),
      });
    } else {
      res.json(contact);
    }
  });
};

/**
 * Contacts list
 */
exports.list = function (req, res) {
  res.json(req.contacts || {});
};

/**
 * Single contact
 */
exports.get = function (req, res) {
  res.json(req.contact || {});
};

/**
 * Single contact by userId
 *
 * - Find contact record where logged in user is a friend of given userId
 */
exports.contactByUserId = function (req, res, next, userId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  // User's own profile, don't bother hitting the DB
  if (req.user && req.user._id === userId) {
    return res.status(400).json({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  if (req.user && req.user.public) {
    Contact.findOne({
      $or: [
        {
          userTo: userId,
          userFrom: req.user._id,
        },
        {
          userTo: req.user._id,
          userFrom: userId,
        },
      ],
    })
      .populate('userTo userFrom', userProfile.userMiniProfileFields)
      .exec(function (err, contact) {
        if (err) return next(err);
        if (!contact) {
          return res.status(404).json({
            message: errorService.getErrorMessageByKey('not-found'),
          });
        }

        req.contact = contact;
        next();
      });
  } else {
    next();
  }
};

/**
 * Single contact by contactId
 */
exports.contactById = function (req, res, next, contactId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    return res.status(400).json({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  if (req.user && req.user.public) {
    Contact.findById(contactId)
      .populate('userTo userFrom', userProfile.userMiniProfileFields)
      .exec(function (err, contact) {
        if (err) return next(err);

        // If nothing was found or neither of the user ID's match currently authenticated user's id, return 404
        if (
          !contact ||
          !req.user ||
          (!contact.userFrom._id.equals(req.user._id.valueOf()) &&
            !contact.userTo._id.equals(req.user._id.valueOf()))
        ) {
          return res.status(404).json({
            message: errorService.getErrorMessageByKey('not-found'),
          });
        }

        req.contact = contact;
        next();
      });
  } else {
    next();
  }
};

/**
 * Contact list middleware for filtering only common contacts
 * Takes already formed contact list and drops out contacts which aren't
 * on currently authenticated user's contact list
 */
exports.filterByCommon = function (req, res, next) {
  // No contacts to match, just continue
  if (!req.contacts.length) {
    return next();
  }

  // Get currently authenticated user's contact list
  Contact.find(
    {
      $or: [{ userFrom: req.user._id }, { userTo: req.user._id }],
      // Include only confirmed contacts
      confirmed: true,
    },
    {
      // By default, the `_id` field is included in the results.
      // Leave it out.
      _id: 0,
      // Return only `userFrom` & `userTo` fields
      userFrom: 1,
      userTo: 1,
      test: '$userTo',
    },
  ).exec(function (err, authUserContacts) {
    if (err) {
      return next(err);
    }

    // No contacts to match, just return empty array
    if (!authUserContacts || !authUserContacts.length) {
      req.contacts = [];
      return next();
    }

    // Remodel authenticated user's contact list to array of user ids
    const authUserContactUsers = [];
    _.map(authUserContacts, function (contact) {
      // Pick user id which isn't authenticated user themself
      const userId = contact.userFrom.equals(req.user._id.valueOf())
        ? contact.userTo
        : contact.userFrom;

      // Ensure we have a list of string id's instead of Mongo ObjectId's
      // Otherwise checking against this list fails using `indexOf()`
      authUserContactUsers.push(userId.toString());
    });

    // Ensure we have a list of string id's instead of Mongo ObjectId's
    // Otherwise checking if we have certain id in this list using `indexOf`
    // becomes difficult.
    // authUserContactUsers = _.map(authUserContactUsers, _.toString);

    // We have both contact lists, do the matching
    // @link https://lodash.com/docs/#filter
    req.contacts = _.filter(req.contacts, function (contact) {
      // Check if `contact.user._id` is also on list of authenticated user's
      // contacts list. Returning truthy will let it trough to `req.contacts`,
      // returning falsy will hold it back.
      return authUserContactUsers.indexOf(contact.user._id.toString()) > -1;
    });

    next();
  });
};

/**
 * Contact list middleware
 */
exports.contactListByUser = function (req, res, next, listUserId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(listUserId)) {
    return res.status(400).json({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  // Turn `listUserId` String into a Mongo ObjectId
  listUserId = new mongoose.Types.ObjectId(listUserId);

  const contactQuery = {
    $or: [{ userFrom: listUserId }, { userTo: listUserId }],
    confirmed: true,
  };

  // Remove `confirmed:true` requirement from queries if currently
  // authenticated user is requesting their own contact list
  if (req.user && req.user._id.equals(listUserId)) {
    delete contactQuery.confirmed;
  }

  Contact.aggregate([
    // Finds all documents where requested user id equals `userFrom` OR `userTo`
    // Optionally limits to documents with `confirmed:true` only
    { $match: contactQuery },

    // Format results
    {
      $project: {
        // Normal contact document fields here
        _id: '$_id',
        confirmed: '$confirmed',
        created: '$created',
        userFrom: '$userFrom',
        userTo: '$userTo',
        // Project a new `user` field, picking ID of either `userFrom` or `userTo` field,
        // depending on which one equals to requested user. This is to avoid populating
        // requested user's profile, as it would just repeat on every document.
        user: {
          $cond: {
            if: { $eq: ['$userFrom', listUserId] },
            then: '$userTo',
            else: '$userFrom',
          },
        },
      },
    },

    // Populate user field: receives whole document of user
    {
      $lookup: {
        from: 'users', // collection to join
        localField: 'user',
        foreignField: '_id', // field(s) from the documents of the "from" collection
        as: 'user', // output array field
      },
    },
    // Because above `$lookup`s return and array with one user
    // `[{userObject}]`, we have to unwind it back to `{userObject}`
    { $unwind: '$user' },

    // Another round of formating results as we now have `user` field populated
    {
      $project: {
        // Normal contact document fields here
        _id: '$_id',
        confirmed: '$confirmed',
        created: '$created',
        userFrom: '$userFrom',
        userTo: '$userTo',
        // Project here fields for the user which isn't the user who's list
        // we requested. I.e. "the other party"
        user: {
          // These should be fields listed at `userProfile.userMiniProfileFields`
          _id: '$user._id',
          updated: '$user.updated',
          displayName: '$user.displayName',
          username: '$user.username',
          avatarSource: '$user.avatarSource',
          avatarUploaded: '$user.avatarUploaded',
          locationFrom: '$user.locationFrom',
          locationLiving: '$user.locationLiving',
          emailHash: '$user.emailHash',
          additionalProvidersData: {
            facebook: {
              id: '$user.additionalProvidersData.facebook.id',
            },
          },
        },
      },
    },
  ]).exec(function (err, contacts) {
    if (err) return next(err);
    if (!contacts) return next(new Error('Failed to load contacts.'));

    req.contacts = contacts;
    next();
  });
};
