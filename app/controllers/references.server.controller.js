'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	errorHandler = require('./errors'),
	Reference = mongoose.model('Reference'),
	_ = require('lodash');

/**
 * Create a Reference
 */
exports.create = function(req, res) {
	var reference = new Reference(req.body);
	reference.user = req.user;

	reference.save(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(reference);
		}
	});
};

/**
 * Show the current Reference
 */
exports.read = function(req, res) {
	res.jsonp(req.reference);
};

/**
 * Update a Reference
 */
exports.update = function(req, res) {
	var reference = req.reference ;

	reference = _.extend(reference , req.body);

	reference.save(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(reference);
		}
	});
};

/**
 * Delete an Reference
 */
exports.delete = function(req, res) {
	var reference = req.reference ;

	reference.remove(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(reference);
		}
	});
};

/**
 * List of References
 */
exports.list = function(req, res) { Reference.find().sort('-created').populate('user', 'displayName').exec(function(err, references) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(references);
		}
	});
};

/**
 * Reference middleware
 */
exports.referenceByID = function(req, res, next, id) { Reference.findById(id).populate('user', 'displayName').exec(function(err, reference) {
		if (err) return next(err);
		if (! reference) return next(new Error('Failed to load Reference ' + id));
		req.reference = reference ;
		next();
	});
};

/**
 * Reference authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {
	if (req.reference.user.id !== req.user.id) {
		return res.status(403).send('User is not authorized');
	}
	next();
};