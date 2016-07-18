'use strict';

/**
 * Module dependencies.
 */

var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    emailsHandler = require(path.resolve('./modules/core/server/controllers/emails.server.controller')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller')),
    config = require(path.resolve('./config/config')),
    sanitizeHtml = require('sanitize-html'),
    htmlToText = require('html-to-text'),
    nodemailer = require('nodemailer'),
    async = require('async'),
    mongoose = require('mongoose'),
    Contact = mongoose.model('Contact'),
    User = mongoose.model('User');

// Replace mailer with Stub mailer transporter
// Stub transport does not send anything, it builds the mail stream into a single Buffer and returns
// it with the sendMail callback. This is useful for testing the emails before actually sending anything.
// @link https://github.com/andris9/nodemailer-stub-transport
if (process.env.NODE_ENV === 'test') {
  var stubTransport = require('nodemailer-stub-transport');
  config.mailer.options = stubTransport();
}

/**
 * Add a contact
 */
exports.add = function(req, res) {

  // Defined in this scope so we can remove it in in the case of an error
  var contact;

  async.waterfall([

    // Validate + Sanitize contact
    function(done) {

      // Not a valid ObjectId
      if(!mongoose.Types.ObjectId.isValid(req.body.friendUserId)) {
        return res.status(400).json({
          message: errorHandler.getErrorMessageByKey('invalid-id')
        });
      }

      // Catch message separately
      var messageHTML = false;
      var messagePlain = false;
      if(req.body.message && req.body.message !== '') {
        messageHTML = sanitizeHtml(req.body.message, textProcessor.sanitizeOptions);
        messagePlain = htmlToText.fromString(req.body.message, {wordwrap: 80});
      }
      delete req.body.message;

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

    // Prepare HTML email for friend
    function(messageHTML, messagePlain, friend, done) {

      var url = (config.https ? 'https' : 'http') + '://' + req.headers.host,
          meURL = url + '/profile/' + req.user.username,
          urlConfirm = url + '/contact-confirm/' + contact._id;

      var renderVars = emailsHandler.addEmailBaseTemplateParams(
        req.headers.host,
        {
          name: friend.displayName,
          message: messageHTML,
          meName: req.user.displayName,
          meURLPlainText: meURL,
          meURL: analyticsHandler.appendUTMParams(meURL, {
            source: 'transactional-email',
            medium: 'email',
            campaign: 'confirm-contact',
            content: 'profile'
          }),
          urlConfirmPlainText: urlConfirm,
          urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
            source: 'transactional-email',
            medium: 'email',
            campaign: 'confirm-contact',
            content: 'confirm-contact'
          })
        },
        'confirm-contact'
      );

      res.render(path.resolve('./modules/core/server/views/email-templates/confirm-contact'), renderVars, function(err, emailHTML) {
        done(err, emailHTML, messagePlain, friend, renderVars);
      });
    },

    // Prepare TEXT email for friend
    function(emailHTML, messagePlain, friend, renderVars, done) {

      // Replace html version of attached message with text version
      renderVars.message = messagePlain;

      res.render(path.resolve('./modules/core/server/views/email-templates-text/confirm-contact'), renderVars, function(err, emailPlain) {
        done(err, emailHTML, emailPlain, friend);
      });
    },

    // If valid email, send email using service
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
        smtpTransport.close(); // close the connection pool
        if (!err) {
          return res.send({
            message: 'An email was sent to your contact.'
          });
        }
        done(err);
      });
    }

  ], function(err) {
    if (err) {
      if (contact) {
        contact.remove(function(){
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
  if(!req.contact || !req.contact.users[0]._id.equals(req.user._id.valueOf())) {
    return res.status(403).json({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Ta'da!
  var contact = req.contact;
	contact.confirmed = true;

	contact.save(function(err) {
		if(err) {
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
  if(!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  // User's own profile, don't bother hitting the DB
  if(req.user && req.user._id === userId) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  if(req.user && req.user.public) {
    Contact.findOne({
      $or: [
        { users: [ userId, req.user._id ] },
        { users: [ req.user._id, userId ] }
      ]
    })
    .populate('users', userHandler.userMiniProfileFields)
    .exec(function(err, contact) {

      if(err) return next(err);
      if(!contact) {
        return res.status(404).json({
          message: errorHandler.getErrorMessageByKey('not-found')
        });
      }

      req.contact = contact;
      next();
    });
  }
  else {
    next();
  }
};


/**
 * Single contact by contactId
 */
exports.contactById = function(req, res, next, contactId) {

  // Not a valid ObjectId
  if(!mongoose.Types.ObjectId.isValid(contactId)) {
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
        if(!contact || !req.user || (
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
  if(!mongoose.Types.ObjectId.isValid(listUserId)) {
    return res.status(400).json({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  var contactQuery = { users: listUserId, confirmed: true };

  // Remove 'confirmed=true' from queries if showing currently logged in user's listing
  if(req.user && req.user._id.equals(listUserId)) {
    delete contactQuery.confirmed;
  }

  Contact.find(contactQuery, 'users created confirmed')
    .sort('-created')
    // Populate users
    .populate({
      path: 'users',
      // ...except don't populate user's own info for confirmed contacts. We don't need it dozen times there:
      //match: { _id: { $ne: listUserId } },
      select: userHandler.userMiniProfileFields
    })
    .exec(function(err, contacts) {
      if(err) return next(err);
      if(!contacts) return next(new Error('Failed to load contacts.'));

      req.contacts = contacts;
      next();
    });
};
