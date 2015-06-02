'use strict';

/**
 * Module dependencies.
 */

var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    config = require(path.resolve('./config/config')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller')),
    messageHandler = require(path.resolve('./modules/messages/server/controllers/messages.server.controller')),
    sanitizeHtml = require('sanitize-html'),
    htmlToText = require('html-to-text'),
    nodemailer = require('nodemailer'),
    async = require('async'),
    mongoose = require('mongoose'),
    Contact = mongoose.model('Contact'),
    User = mongoose.model('User');


/**
 * Add a contact
 */
exports.add = function(req, res) {

  async.waterfall([

    // Sanitize contact
    function(done) {

      // Catch message separately
      var messageHTML = false;
      var messagePlain = false;
      if(req.body.message && req.body.message !== '') {
        messageHTML = sanitizeHtml(req.body.message, messageHandler.messageSanitizeOptions);
        messagePlain = htmlToText.fromString(req.body.message, {wordwrap: 80});
      }
      delete req.body.message;

      var contact = new Contact(req.body);
      contact.confirmed = false;
      contact.users = [];
      contact.users.push(req.body.friendUserId);
      contact.users.push(req.user._id);
      // Now:
      // - contact.useres[0] is receiving person
      // - contact.useres[1] is initiating person

      done(null, contact, messageHTML, messagePlain);
    },

    // Find friend
    function(contact, messageHTML, messagePlain, done) {
      User.findById(req.body.friendUserId, 'email displayName').exec(function(err, friend) {
        if (!friend) done(new Error('Failed to load user ' + req.body.friendUserId));

        done(err, contact, messageHTML, messagePlain, friend);
      });
    },

    // Save contact
    function(contact, messageHTML, messagePlain, friend, done) {
      contact.save(function(err) {
        done(err, contact, messageHTML, messagePlain, friend);
      });
    },

    // Prepare HTML email for friend
    function(contact, messageHTML, messagePlain, friend, done) {

      var url = (config.https ? 'https' : 'http') + '://' + req.headers.host;
      var renderVars = {
        name: friend.displayName,
        message: messageHTML,
        meName: req.user.displayName,
        url: url,
        meURL: url + '/profile/' + req.user.username,
        urlConfirm: url + '/contact-confirm/' + contact._id,
      };

      res.render(path.resolve('./modules/core/server/views/email-templates/confirm-contact'), renderVars, function(err, emailHTML) {
        done(err, contact, emailHTML, messagePlain, friend, renderVars);
      });
    },

    // Prepare TEXT email for friend
    function(contact, emailHTML, messagePlain, friend, renderVars, done) {

      // Replace html version of attached message with text version
      renderVars.message = messagePlain;

      res.render(path.resolve('./modules/core/server/views/email-templates-text/confirm-contact'), renderVars, function(err, emailPlain) {
        done(err, emailHTML, emailPlain, friend);
      });
    },

    // If valid email, send reset email using service
    function(emailHTML, emailPlain, friend, done) {
      var smtpTransport = nodemailer.createTransport(config.mailer.options);
      var mailOptions = {
        to: {
          name: friend.displayName,
          address: friend.email
        },
        from: 'Trustroots <' + config.mailer.from + '>',
        subject: 'Confirm contact',
        text: emailPlain,
        html: emailHTML
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        if (!err) {
          res.send({
            message: 'An email was sent to your contact.'
          });
        }
        smtpTransport.close(); // close the connection pool
        done(err);
      });
    }

  ], function(err) {
    if (err) {
      console.log('Error: Contacts controller -> add');
      console.log(err);
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
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
      console.log('Error: Contacts controller -> remove');
      console.log(err);
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
	var contact = req.contact;

	contact.confirmed = true;

	contact.save(function(err) {
		if (err) {
      console.log('Error: Contacts controller -> confirm');
      console.log(err);
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
  res.json(req.contacts || null);
};

/**
 * Single contact
 */
exports.get = function(req, res) {
 res.json(req.contact || null);
};

/**
 * Single contact by user middleware
 *
 * - Find contact record where logged in user is a friend of given userId
 */
exports.contactByUserId = function(req, res, next, userId) {

  // User's own profile, don't bother hitting the DB
  if(req.user && req.user._id === userId) {
    next();
  }
  else if(req.user) {
    Contact.findOne({
        users: { $all: [ userId, req.user._id ] }
      })
      .populate('users', userHandler.userMiniProfileFields)
      .exec(function(err, contact) {
        if (err) return next(err);
        if(contact) {
          req.contact = contact;
        }
        next();
    });
  }
  else {
    next();
  }
};


/**
 * Single contact contact by id middleware
 *
 * - Find contact record where logged in user is a friend of given userId
 */
exports.contactById = function(req, res, next, contactId) {
  Contact.findById(contactId)
    .populate('users', userHandler.userMiniProfileFields)
    .exec(function(err, contact) {
      if (err) return next(err);
      if (!contact) return next(new Error('Failed to load contact.'));

      req.contact = contact;
      next();
    });
};

/**
 * Contact list middleware
 */
exports.contactListByUser = function(req, res, next, listUserId) {

  // Add 'confirmed' field only if showing currently logged in user's listing
  var contactFields = 'users created';
  var contactQuery = { users: listUserId, confirmed: true };

  if(req.user && req.user.id === listUserId) {
    contactFields += ' confirmed';
    delete contactQuery.confirmed;
  }

  Contact.find(contactQuery, contactFields)
    .sort('-created')
    // Populate users, except don't populate user's own info... we don't need it dozen times there
    .populate({
      path: 'users',
      match: { _id: { $ne: listUserId } },
      select: userHandler.userMiniProfileFields
    })
    .exec(function(err, contacts) {
      if (err) return next(err);
      if (!contacts) return next(new Error('Failed to load contacts.'));

      req.contacts = contacts;
      next();
    });
};


/**
 * Contact authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {

  if(!req.contact) {
    return res.status(404).send('Contact not found.');
  }

  // This is double since in some cases user field is populated, thus we'll get "_id" instead of "id"
  // - contact.useres[0] is receiving person
  // - contact.useres[1] is initiating person
  var userTo, userFrom;

  if(req.contact.users[0]._id) userTo = req.contact.users[0]._id;
  else if(req.contact.users[0].id) userTo = req.contact.users[0].id;

  if(req.contact.users[1]._id) userFrom = req.contact.users[1]._id;
  else if(req.contact.users[1].id) userFrom = req.contact.users[1].id;

  if (
    // User is registered and public
    (req.user && req.user.public === true) &&
    // User is participant in connection
    (userFrom && userTo) &&
    (userFrom.toString() === req.user.id.toString() || userTo.toString() === req.user.id.toString())
  ) {
    next();
  } else {
    return res.status(403).send('User is not authorized');
  }
};

/**
 * Contact authorization middleware
 *
 * Used when confirming contact, so that initiator
 * cannot confirm on receivers behalf.
 */
exports.receiverHasAuthorization = function(req, res, next) {
  if (req.user.public === true && req.contact && req.contact.users[0].id === req.user.id) {
    next();
  } else {
    return res.status(403).send('User is not authorized');
  }
};
