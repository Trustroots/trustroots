'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors'),
    sanitizeHtml = require('sanitize-html'),
    htmlToText = require('html-to-text'),
    nodemailer = require('nodemailer'),
    userHandler = require('./users'),
    messageHandler = require('./messages'),
    config = require('../../config/config'),
    async = require('async'),
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

      done(null, contact, messageHTML, messagePlain);
    },

    // Find friend
    function(contact, messageHTML, messagePlain, done) {
      User.findById(req.body.friendUserId, 'email').exec(function(err, friend) {
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

      res.render('email-templates/confirm-contact', {
        name: friend.displayName,
        message: messageHTML,
        meName: req.user.displayName,
        meURL: url + '/#!/profile/' + req.user.username,
        urlConfirm: url + '/#!/contact-confirm/' + contact._id,
      }, function(err, emailHTML) {
        done(err, contact, emailHTML, messagePlain, friend);
      });
    },

    // Prepare TEXT email for friend
    function(contact, emailHTML, messagePlain, friend, done) {

      var url = (config.https ? 'https' : 'http') + '://' + req.headers.host;

      res.render('email-templates-text/confirm-contact', {
        name: friend.displayName,
        message: messagePlain,
        meName: req.user.displayName,
        meURL: url + '/#!/profile/' + req.user.username,
        urlConfirm: url + '/#!/contact-confirm/' + contact._id,
      }, function(err, emailPlain) {
        done(err, emailHTML, emailPlain, friend);
      });
    },

    // If valid email, send reset email using service
    function(emailHTML, emailPlain, friend, done) {

      var smtpTransport = nodemailer.createTransport(config.mailer.options);
      var mailOptions = {
        to: friend.email,
        from: config.mailer.from,
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

        done(err);
      });
    }

  ], function(err) {
    if (err) {
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
 *
exports.contactByUser = function(req, res, next, userId) {
  Contact.findOne(
      {
        users: { $all: [ userId, req.user._id ] }
        // @todo: Show confirmed ones only to user him/herself
        //confirmed: true
      }
    )
    .populate('users', userHandler.userMiniProfileFields)
    .exec(function(err, contact) {
      if (err) return next(err);
      if (!contact) return next(new Error('Failed to load contact.'));

      req.contact = contact;
      next();
    });
};
*/

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
  if(listUserId === req.user._id) {
    contactFields += ' confirmed';
  }

  Contact.find(
      {
        users: listUserId,
        // @todo: Show confirmed ones only to user him/herself
        confirmed: true
      },
      contactFields
    )
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

  if (req.user.public === true && req.contact && (req.contact.users[0].id === req.user.id || req.contact.users[1].id === req.user.id)) {
    next();
  } else {
    return res.status(403).send('User is not authorized');
  }
};
