'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
	errorHandler = require('../errors'),
	mongoose = require('mongoose'),
	passport = require('passport'),
	sanitizeHtml = require('sanitize-html'),
	User = mongoose.model('User');


/**
* Rules for sanitizing user description coming in and out
* @link https://github.com/punkave/sanitize-html
*/
var userSanitizeOptions = {
		allowedTags: [ 'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'li', 'ul', 'ol', 'blockquote', 'code', 'pre' ],
		allowedAttributes: {
			'a': [ 'href' ],
			// We don't currently allow img itself, but this would make sense if we did:
			//'img': [ 'src' ]
		},
		selfClosing: [ 'img', 'br' ],
		// URL schemes we permit
		allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel' ]
	};


/**
 * Update user details
 */
exports.update = function(req, res) {
	// Init Variables
	var user = req.user;
	var message = null;

	// For security measurement we remove the roles from the req.body object
	delete req.body.roles;

	if (user) {
		// Merge existing user
		user = _.extend(user, req.body);
		user.updated = Date.now();
		user.displayName = user.firstName + ' ' + user.lastName;

	  // Sanitize user description
	  user.description = sanitizeHtml(user.description, userSanitizeOptions);

		user.save(function(err) {
			if (err) {
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else {
				req.login(user, function(err) {
					if (err) {
						res.status(400).send(err);
					} else {
						res.jsonp(user);
					}
				});
			}
		});
	} else {
		res.status(400).send({
			message: 'User is not signed in'
		});
	}
};

/**
 * Send User
 */
exports.me = function(req, res) {
	res.jsonp(req.user || null);
};


/**
 * Show the profile of the user
 */
exports.getUser = function(req, res) {
	res.jsonp(req.user || null);
};

/**
 * Show the mini profile of the user
 * Pick only certain fields from whole profile @link http://underscorejs.org/#pick
 */
exports.getMiniUser = function(req, res) {
	res.jsonp( _.pick(req.user, 'id', 'displayName', 'username') || null );
};


/**
 * List of Profiles
 */
exports.list = function(req, res) {
	User.find().sort('-created').exec(function(err, users) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(users);
		}
	});
};


/**
 * Profile middleware
 */
exports.userByID = function(req, res, next, id) {
	User.findById(id).exec(function(err, user) {
		if (err) return next(err);
		if (!user) return next(new Error('Failed to load user ' + id));

		// Sanitize output
		user.description = sanitizeHtml(user.description, userSanitizeOptions);

		req.user = user;
		next();
	});
};

exports.userByUsername = function(req, res, next, username) {
	User.findOne({
    	username: username
	}).exec(function(err, user) {
		if (err) return next(err);
		if (!user) return next(new Error('Failed to load user ' + username));

		// Sanitize output
		user.description = sanitizeHtml(user.description, userSanitizeOptions);
		
		req.user = user;
		next();
	});

};
