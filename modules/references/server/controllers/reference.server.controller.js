'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    path = require('path'),
    async = require('async'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    pushService = require(path.resolve('./modules/core/server/services/push.server.service')),
    Reference = mongoose.model('Reference'),
    User = mongoose.model('User');

function validateCreate(req) {
  var valid = true;
  var details = [];

  // Can't create a reference to oneself
  if (req.user._id.toString() === req.body.userTo) {
    valid = false;
    details.push('Reference to self.');
  }

  // Some interaction must have happened
  var isInteraction = req.body.met || req.body.hostedMe || req.body.hostedThem;
  if (!isInteraction) {
    valid = false;
    details.push('No interaction.');
  }

  // Value of 'recommend' must be valid ('yes', 'no', 'unknown')
  if (req.body.recommend && !['yes', 'no', 'unknown'].includes(req.body.recommend)) {
    valid = false;
    details.push('Invalid recommendation.');
  }

  // Values of interactions must be boolean
  ['met', 'hostedMe', 'hostedThem'].forEach(function (interaction) {
    if (req.body.hasOwnProperty(interaction) && typeof req.body[interaction] !== 'boolean') {
      valid = false;
      details.push('Value of \'' + interaction + '\' should be a boolean.');
    }
  });

  // Value of userTo must exist and be a UserId
  if (!req.body.hasOwnProperty('userTo')) {
    valid = false;
    details.push('Missing userTo.');
  } else if (!mongoose.Types.ObjectId.isValid(req.body.userTo)) {
    valid = false;
    details.push('Value of userTo must be a user id.');
  }

  // No unexpected fields
  var allowedFields = ['userTo', 'met', 'hostedMe', 'hostedThem', 'recommend'];
  var fields = Object.keys(req.body);
  var unexpectedFields = _.difference(fields, allowedFields);
  if (unexpectedFields.length > 0) {
    valid = false;
    details.push('Unexpected fields.');
  }

  return { valid: valid, details: details };
}

function create(req, res, next) {

  var userTo; // not to have to pass found user in callbacks

  return async.waterfall([
    // Synchronous validation of the request data consistency
    function validation(cb) {
      var validation = validateCreate(req);

      if (validation.valid) {
        return cb();
      }

      return cb({ status: 400, body: { errType: 'bad-request', details: validation.details } });
    },
    // Check if the receiver of the reference exists and is public
    function isUserToPublic(cb) {
      User.findOne({ _id: req.body.userTo }).exec(function (err, foundUser) {
        if (err) return cb(err);

        userTo = foundUser;

        // Can't create a reference to a nonexistent user
        // Can't create a reference to a nonpublic user
        if (!userTo || !userTo.public) {
          return cb({
            status: 404,
            body: {
              errType: 'not-found',
              detail: 'User not found.'
            }
          });
        }

        return cb();
      });
    },
    // Check if the opposite direction reference exists
    // when it exists, we want to make both references public
    function getOtherReference(cb) {
      Reference.findOne({ userFrom: req.body.userTo, userTo: req.user._id }).exec(function (err, ref) {
        cb(err, ref);
      });
    },
    // save the reference...
    function saveNewReference(otherReference, cb) {

      // ... when the other reference is public, this one can only have value of recommend: yes ...
      if (otherReference && otherReference.public && req.body.recommend !== 'yes') {
        return cb({
          status: 400,
          body: {
            errType: 'bad-request',
            details: ['Only a positive recommendation is allowed in response to a public reference.']
          }
        });
      }

      // ...and make it public if it is a reference reply
      var reference = new Reference(_.merge(req.body, { userFrom: req.user._id, public: !!otherReference }));

      reference.save(function (err, savedReference) {

        // manage errors
        if (err) {

          // conflict
          var isConflict = err.errors && err.errors.userFrom && err.errors.userTo &&
            err.errors.userFrom.kind === 'unique' && err.errors.userTo.kind === 'unique';
          if (isConflict) {
            return cb({
              status: 409,
              body: { errType: 'conflict' }
            });
          }

          // any other error
          return cb(err);
        }

        return cb(null, savedReference, otherReference);

      });
    },
    // ...and if this is a reference reply, make the other reference public, too
    function (savedReference, otherReference, cb) {
      if (otherReference && !otherReference.public) {
        otherReference.set({ public: true });
        return otherReference.save(function (err) {
          return cb(err, savedReference, otherReference);
        });
      }

      return cb(null, savedReference, otherReference);
    },
    // send email notification
    function (savedReference, otherReference, cb) {
      if (!otherReference) {
        return emailService.sendReferenceNotificationFirst(req.user, userTo, function (err) {
          cb(err, savedReference, otherReference);
        });
      } else {
        return emailService.sendReferenceNotificationSecond(req.user, userTo, savedReference, function (err) {
          cb(err, savedReference, otherReference);
        });
      }
    },
    // send push notification
    function (savedReference, otherReference, cb) {
      return pushService.notifyNewReference(req.user, userTo, { isFirst: !otherReference }, function (err) {
        cb(err, savedReference);
      });
    },
    // finally, respond
    function (savedReference, cb) {
      return cb({
        status: 201,
        body: {
          userFrom: savedReference.userFrom,
          userTo: savedReference.userTo,
          recommend: savedReference.recommend,
          created: savedReference.created.getTime(),
          met: savedReference.met,
          hostedMe: savedReference.hostedMe,
          hostedThem: savedReference.hostedThem,
          id: savedReference._id,
          public: savedReference.public
        }
      });
    }
  ], function (err) {
    if (err && err.status && err.body) {
      if (err.body.errType) {
        err.body.message = errorService.getErrorMessageByKey(err.body.errType);
        delete err.body.errType;
      }
      return res.status(err.status).json(err.body);
    }

    return next(err);
  });
}

module.exports = {
  create: create
};
