import _ from 'lodash';
import errorService from '../../../core/server/services/error.server.service.mjs';
import textService from '../../../core/server/services/text.server.service.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import userRolesService from '../../../users/server/services/user-roles.server.service.mjs';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import sanitizeHtml from 'sanitize-html';
import htmlToText from 'html-to-text';
import async from 'async';
import mongoose from 'mongoose';
const service = {};

/**
 * Module dependencies.
 */
const Contact = mongoose.model('Contact');
const User = mongoose.model('User');

/**
 * Add a contact
 */
service.add = function (req, res) {
  // Defined in this scope so we can remove it in in the case of an error
  let contact;

  // Shadowbanned members should not learn that their requests are hidden.
  if (userRolesService.hasRestrictedMessagingRole(req.user)) {
    return res.send({
      message: 'An email was sent to your contact.',
    });
  }
  async.waterfall(
    [
      // Validate
      function (done) {
        // Not a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.body.friendUserId))
          return errorService.sendInvalidId(res);

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
      // Find friend before creating a contact, so restricted profiles do not
      // receive a request or reveal that they exist.
      function (messageHTML, messagePlain, done) {
        User.findOne(
          {
            _id: req.body.friendUserId,
            roles: {
              $nin: userRolesService.restrictedMessagingRoles,
            },
          },
          'email displayName roles',
        ).exec(function (err, friend) {
          if (!friend)
            return done(
              new Error('Failed to load user ' + req.body.friendUserId),
            );
          done(err, messageHTML, messagePlain, friend);
        });
      },
      // Create Contact
      function (messageHTML, messagePlain, friend, done) {
        contact = new Contact(req.body);
        contact.confirmed = false;
        contact.userFrom = req.user._id;
        contact.userTo = req.body.friendUserId;
        done(null, messageHTML, messagePlain, friend);
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
      /* istanbul ignore else */
      if (err) {
        if (contact) {
          contact.remove(function () {
            return errorService.sendBadRequest(res, err);
          });
        } else {
          return errorService.sendBadRequest(res, err);
        }
      }
    },
  );
};

/**
 * Disconnect contact
 */
service.remove = function (req, res) {
  const contact = req.contact;
  contact.remove(function (err) {
    if (err) {
      return errorService.sendBadRequest(res, err);
    } else {
      res.status(200).send({
        message: 'Contact removed.',
      });
    }
  });
};

/**
 * Clear all contacts by user id
 */
service.removeAllByUserId = function (userId, callback) {
  Contact.deleteMany(
    {
      $or: [
        {
          userTo: userId,
        },
        {
          userFrom: userId,
        },
      ],
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
service.confirm = function (req, res) {
  // Only receiving user can confirm user connections
  if (!req.contact || !req.contact.userTo._id.equals(req.user._id.valueOf())) {
    return errorService.sendForbidden(res);
  }

  // Ta'da!
  const contact = req.contact;
  contact.confirmed = true;
  contact.save(function (err) {
    if (err) {
      return errorService.sendBadRequest(res, err);
    } else {
      res.json(contact);
    }
  });
};

/**
 * Contacts list
 */
service.list = function (req, res) {
  res.json(req.contacts || {});
};

/**
 * Single contact
 */
service.get = function (req, res) {
  res.json(req.contact || {});
};

/**
 * Single contact by userId
 *
 * - Find contact record where logged in user is a friend of given userId
 */
service.contactByUserId = function (req, res, next, userId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId))
    return errorService.sendInvalidId(res);

  // User's own profile, don't bother hitting the DB
  if (req.user && req.user._id === userId) {
    return errorService.sendInvalidId(res);
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
      .populate(
        userMiniService.miniUserPopulate('userTo userFrom', {
          excludeRestrictedRoles: true,
        }),
      )
      .exec(function (err, contact) {
        if (err) return next(err);
        if (!contact || !contact.userFrom || !contact.userTo) {
          return errorService.sendNotFound(res);
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
service.contactById = function (req, res, next, contactId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(contactId))
    return errorService.sendInvalidId(res);

  if (req.user && req.user.public) {
    Contact.findById(contactId)
      .populate(
        userMiniService.miniUserPopulate('userTo userFrom', {
          excludeRestrictedRoles: true,
        }),
      )
      .exec(function (err, contact) {
        if (err) return next(err);

        // If nothing was found or neither of the user ID's match currently authenticated user's id, return 404
        if (
          !contact ||
          !contact.userFrom ||
          !contact.userTo ||
          !req.user ||
          (!contact.userFrom._id.equals(req.user._id.valueOf()) &&
            !contact.userTo._id.equals(req.user._id.valueOf()))
        ) {
          return errorService.sendNotFound(res);
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
service.filterByCommon = function (req, res, next) {
  // No contacts to match, just continue
  if (!req.contacts.length) {
    return next();
  }

  // Get currently authenticated user's contact list
  Contact.find(
    {
      $or: [
        {
          userFrom: req.user._id,
        },
        {
          userTo: req.user._id,
        },
      ],
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
service.contactListByUser = function (req, res, next, listUserId) {
  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(listUserId))
    return errorService.sendInvalidId(res);

  // Turn `listUserId` String into a Mongo ObjectId
  listUserId = new mongoose.Types.ObjectId(listUserId);
  const contactQuery = {
    $or: [
      {
        userFrom: listUserId,
      },
      {
        userTo: listUserId,
      },
    ],
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
    {
      $match: contactQuery,
    },
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
            if: {
              $eq: ['$userFrom', listUserId],
            },
            then: '$userTo',
            else: '$userFrom',
          },
        },
      },
    },
    // Populate user field: receives whole document of user
    // Because `$lookup`s return an array with one user `[{userObject}]`,
    // the helper unwinds it back to `{userObject}`
    // Existing relationship records may outlive a moderation action. Keep
    // restricted members out of all user-facing contact lists.
    ...userMiniService.visibleUserLookupStages({
      localField: 'user',
      as: 'user',
    }),

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
        // Projection is derived from the shared mini profile service,
        // extended with contact-specific location fields.
        user: userMiniService.userMiniProjection('$user', {
          locationFrom: '$user.locationFrom',
          locationLiving: '$user.locationLiving',
        }),
      },
    },
  ]).exec(function (err, contacts) {
    if (err) return next(err);
    if (!contacts) return next(new Error('Failed to load contacts.'));
    req.contacts = contacts;
    next();
  });
};
const add = service.add;
const confirm = service.confirm;
const contactById = service.contactById;
const contactByUserId = service.contactByUserId;
const contactListByUser = service.contactListByUser;
const filterByCommon = service.filterByCommon;
const get = service.get;
const list = service.list;
const remove = service.remove;
const removeAllByUserId = service.removeAllByUserId;
export {
  add,
  confirm,
  contactById,
  contactByUserId,
  contactListByUser,
  filterByCommon,
  get,
  list,
  remove,
  removeAllByUserId,
};
export default service;
export { service as 'module.exports' };
