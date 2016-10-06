'use strict';

/**
 * Module dependencies.
 */

var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller')),
    sanitizeHtml = require('sanitize-html'),
    htmlToText = require('html-to-text'),
    async = require('async'),
    mongoose = require('mongoose'),
    Contact = mongoose.model('Contact'),
    User = mongoose.model('User');

/**
 * Add a contact
 */
exports.add = function(req, res) {

  // Defined in this scope so we can remove it in in the case of an error
  var contact;

  async.waterfall([

    // Validate
    function(done) {

      // Not a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(req.body.friendUserId)) {
        return res.status(400).json({
          message: errorHandler.getErrorMessageByKey('invalid-id')
        });
      }

      // Check if contact already exists
      Contact.findOne({
        $or: [
          { users: [req.body.friendUserId, req.user._id] },
          { users: [req.user._id, req.body.friendUserId] }
        ]
      }).exec(function(err, existingContact) {
        if (err) return done(err);

        if (existingContact) {
          // Contact already exists!
          return res.status(409).json({
            message: errorHandler.getErrorMessageByKey('conflict'),
            confirmed: existingContact.confirmed
          });
        }

        done();
      });
    },

     // Sanitize message
    function(done) {

      // Catch message separately
      var messageHTML = false;
      var messagePlain = false;
      if (req.body.message && req.body.message !== '') {
        messageHTML = sanitizeHtml(req.body.message, textProcessor.sanitizeOptions);
        messagePlain = htmlToText.fromString(req.body.message, { wordwrap: 80 });
      }
      delete req.body.message;

      done(null, messageHTML, messagePlain);
    },

    // Create Contact
    function(messageHTML, messagePlain, done) {

      contact = new Contact(req.body);
      contact.confirmed = false;
      contact.users = [];
      contact.users.push(req.body.friendUserId);
      contact.users.push(req.user._id);
      // Now:
      // - contact.users[0] is receiving person
      // - contact.users[1] is initiating person

      done(null, messageHTML, messagePlain);
    },

    // Find friend
    function(messageHTML, messagePlain, done) {
      User.findById(req.body.friendUserId, 'email displayName').exec(function(err, friend) {
        if (!friend) return done(new Error('Failed to load user ' + req.body.friendUserId));

        done(err, messageHTML, messagePlain, friend);
      });
    },

    // Save contact
    function(messageHTML, messagePlain, friend, done) {
      contact.save(function(err) {
        done(err, messageHTML, messagePlain, friend);
      });
    },

    // Send email
    function(messageHTML, messagePlain, friend, done) {
      emailService.sendConfirmContact(req.user, friend, contact, messageHTML, messagePlain, function(err) {
        if (err) return done(err);
        return res.send({
          message: 'An email was sent to your contact.'
        });
      });
    }

  ], function(err) {
    if (err) {
      if (contact) {
        contact.remove(function() {
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
          });
        });
      } else {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      }
    }
  });

};


/**
 * Disconnect contact
 */
exports.remove = function(req, res) {
  var contact = req.contact;

  contact.remove(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(contact);
    }
  });
};


/**
 * Confirm (i.e. update) contact
 */
exports.confirm = function(req, res) {

  // Only receiving user can confirm user connections
  if (!req.contact || !req.contact.users[0]._id.equals(req.user._id.valueOf())) {
    return res.status(403).json({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Ta'da!
  var contact = req.contact;
  contact.confirmed = true;

  contact.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(contact);
    }
  });
};

/**
 * Contacts list
 */
exports.list = function(req, res) {
  res.json(req.contacts || {});
};

/**
 * Single contact
 */
exports.get = function(req, res) {
  res.json(req.contact || {});
};

/**
 * Single contact by userId
 *
 * - Find contact record where logged in user is a friend of given userId
 */
exports.contactByUserId = function(req, res, next, userId) {

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  // User's own profile, don't bother hitting the DB
  if (req.user && req.user._id === userId) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  if (req.user && req.user.public) {
    Contact.findOne({
      $or: [
        { users: [userId, req.user._id] },
        { users: [req.user._id, userId] }
      ]
    })
    .populate('users', userHandler.userMiniProfileFields)
    .exec(function(err, contact) {

      if (err) return next(err);
      if (!contact) {
        return res.status(404).json({
          message: errorHandler.getErrorMessageByKey('not-found')
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
exports.contactById = function(req, res, next, contactId) {

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  if (req.user && req.user.public) {
    Contact.findById(contactId)
      .populate('users', userHandler.userMiniProfileFields)
      .exec(function(err, contact) {
        if (err) return next(err);

        // If nothing was found or neither of the user ID's match currently authenticated user's id, return 404
        if (!contact || !req.user || (
            !contact.users[0]._id.equals(req.user._id.valueOf()) &&
            !contact.users[1]._id.equals(req.user._id.valueOf())
        )) {
          return res.status(404).json({
            message: errorHandler.getErrorMessageByKey('not-found')
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
 * Contact list middleware
 */
exports.contactListByUser = function(req, res, next, listUserId) {

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(listUserId)) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  var contactQuery = { users: listUserId, confirmed: true };

  // Remove 'confirmed=true' from queries if showing currently logged in user's listing
  if (req.user && req.user._id.equals(listUserId)) {
    delete contactQuery.confirmed;
  }

  Contact.find(contactQuery, 'users created confirmed')
    .sort('-created')
    // Populate users
    .populate({
      path: 'users',
      // ...except don't populate user's own info for confirmed contacts. We don't need it dozen times there:
      // match: { _id: { $ne: listUserId } },
      select: userHandler.userMiniProfileFields
    })
    .exec(function(err, contacts) {
      if (err) return next(err);
      if (!contacts) return next(new Error('Failed to load contacts.'));

      req.contacts = contacts;
      next();
    });
};
