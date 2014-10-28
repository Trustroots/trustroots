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
  reference.userFrom = req.user;
  reference.updated = null;

  reference.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(reference);
    }
  });
};

/**
 * Show the current Reference
 */
exports.read = function(req, res) {
  res.json(req.reference);
};

/**
 * Update a Reference
 */
exports.update = function(req, res) {
  var reference = req.reference;

  // Make sure we won't touch creation date, but do change update timestamp
  if(req.body.created) delete req.body.created;

  reference = _.extend(reference , req.body);

  reference.updated = new Date();

  reference.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {

      // We'll need some info about related users, populate some fields
      reference
        .populate({
          path: 'userTo',
          select: userMiniProfileFields
        }, function(err, reference) {
          if (err) {
            return res.status(400).send({
              message: errorHandler.getErrorMessage(err)
            });
          } else {
            // Response
            res.json(reference);
          }
        });

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
      res.json(reference);
    }
  });
};

/**
 * List of References
 */
exports.list = function(req, res) {
    console.log('->list');
    res.json(req.references);
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

exports.referencesByUser = function(req, res, next, userId) {
  Reference
    .find({
      //$or: [
      //  { userFrom: userId },
      //  { userTo: userId }
      //]
      userTo: userId
    })
    .populate('userFrom', userMiniProfileFields)
    .populate('userTo', userMiniProfileFields)
    .exec(function(err, references) {
      if (err) return next(err);
      if (! references) return next(new Error('Failed to load References for user ' + userId));
      req.references = references;
      next();
    });
};


/**
 * Reference authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {
  if (req.reference.userFrom.id !== req.user.id) {
    return res.status(403).send('User is not authorized');
  }
  next();
};
