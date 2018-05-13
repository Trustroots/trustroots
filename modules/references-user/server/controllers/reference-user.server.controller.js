'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    // statService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    // log = require(path.resolve('./config/lib/logger')),
    // async = require('async'),
    mongoose = require('mongoose');
    // Message = mongoose.model('Message'),
    // User = mongoose.model('User'),
    // ReferenceUser = mongoose.model('ReferenceUser');

/**
 * Create a new user reference
 */
exports.createReferenceUser = function (req, res) {

  if (!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Validate userTo ID
  if (!mongoose.Types.ObjectId.isValid(req.body.userTo)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  res.status(400).send();
};


/**
 * Show the current Offer
 */
exports.readReferenceUser = function (req, res) {
  res.json(req.referenceUser || []);
};


// Reference Thread reading middleware
exports.readReferenceUserById = function (req, res, next, userToId) {

  // Check if user is authenticated
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userToId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  /*
  async.waterfall([
    // Check if we have refference user stored
    function (done) {
      ReferenceUser.findOne({
        userTo: userToId,
        userFrom: req.user._id // Ensure we get only references we are allowed to read
      })
        .sort('-created') // Latest first
        .exec(function (err, referenceThread) {
          if (err) return done(err);

          // Found, move on to the next middleware
          if (referenceThread) {
            req.referenceThread = referenceThread;
            return next();
          } else {
          // No existing reference thread found, move on to do more checks
            done(null);
          }
        });
    },

    // Since no pre-existing reference thread found,
    // check if authenticated user would be allowed to send reference to this user at all
    function (done) {
      Message.findOne({
        userFrom: userToId,
        userTo: req.user._id
      }, function (err, message) {
        if (err) return done(err);

        // Return 404, but also let client know if we would allow creating a referenceThread
        return res.status(404).send({
          message: errorService.getErrorMessageByKey('not-found'),
          allowCreatingReference: Boolean(message)
        });
      });
    }

  ], function (err) {
    if (err) {
      return next(err);
    }
  });
  */
  return next();
};
