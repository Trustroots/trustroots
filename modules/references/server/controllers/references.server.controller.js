'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    // statService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    // log = require(path.resolve('./config/lib/logger')),
    async = require('async'),
    _ = require('lodash'),
    mongoose = require('mongoose'),
    // Message = mongoose.model('Message'),
    // User = mongoose.model('User'),
    Reference = mongoose.model('Reference');

var fieldsAllowedToModify = [
  'userTo',
  'met',
  'hosted_me',
  'hosted_them',
  'recommend',
  'feedbackPublic',
  'feedbackPrivate'
];

/**
 * Create a new user reference
 */
exports.saveReference = function (req, res) {

  console.log('->saveReference');
  console.log(req.body);
  console.log(req.references);

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

  async.waterfall([

    // Check if we have refference stored already
    function (done) {
      console.log('check for previous ref');

      Reference.findOne({
        userTo: req.body.userToId,
        userFrom: req.user._id // Ensure we get only references we are allowed to read
      })
        .exec(function (err, reference) {
          if (err) {
            return done(err);
          }

          // Found existing reference, stop here
          if (reference) {
            return res.status(403).send({
              message: 'You already wrote a reference for them.'
            });
          }

          done();
        });

    },

    // Save reference
    function () {
      console.log('save ref');

      // Create new offer by filtering out what users can modify
      // When creating an offer, we allow type field
      var offer = new Reference(_.pick(req.body, _.concat(fieldsAllowedToModify, 'type')));

      offer.userFrom = req.user._id;

      offer.save(function (err) {
        if (err) {
          return res.status(400).send({
            message: 'Failed to save reference.'
          });
        }

        res.json({
          message: 'Reference saved.'
        });
      });

    }

  ], function (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err)
      });
    }
  });

};

/*
function sanitizeReference(reference) {
  reference = reference.toObject();

  return reference;
}
*/

/**
 * Show the current reference
 */
exports.readReferences = function (req, res) {
  res.json(req.references || []);
};


// References reading middleware
exports.getReferencesByUserId = function (req, res, next, userToId) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userToId) ||
    (typeof req.query.userFromId !== 'undefined' && !mongoose.Types.ObjectId.isValid(req.query.userFromId))
  ) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  var query = {
    userTo: userToId,
    public: true
  }

  if (req.query.userFromId) {
    query.userFrom = req.query.userFromId;
  }

  Reference.find(query)
    .sort('-created') // Latest first
    .exec(function (err, references) {
      req.references = references || [];
      return next();
    });
};

/**
 * Count public references given for a user
 *
 * @return int Number of references
 */
exports.getReferencesCount = function (userToId, callback) {
  Reference.findOne({
    userTo: userToId,
    public: true
  })
    .exec(callback);
};
