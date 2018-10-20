'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    path = require('path'),
    async = require('async'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    Reference = mongoose.model('Reference'),
    User = mongoose.model('User');

function create(req, res, next) {

  return async.waterfall([
    // Synchronous validation of the data consistency
    function validation(cb) {
      // Can't create a reference to oneself
      var valid = true;
      var detail = '';

      if (req.user._id.toString() === req.body.userTo) {
        valid = false;
        detail = 'Reference to self.';
      }

      if (valid) {
        return cb();
      }

      return cb({ status: 400, body: { errType: 'bad-request', detail: detail } });
    },
    // Check if the receiver of the reference exists and is public
    function isUserToPublic(cb) {
      User.findOne({ _id: req.body.userTo }).exec(function (err, userTo) {
        if (err) return cb(err);

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
            detail: 'Only a positive recommendation is allowed in response to a public reference.'
          }
        });
      }

      // ...and make it public if it is a reference reply
      var reference = new Reference(_.merge(req.body, { userFrom: req.user._id, public: !!otherReference }));

      reference.save(function (err, savedReference) {

        // manage errors
        if (err) {
          var isConflict = err.errors && err.errors.userFrom && err.errors.userTo &&
            err.errors.userFrom.kind === 'unique' && err.errors.userTo.kind === 'unique';

          // conflict
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
          return cb(err, savedReference);
        });
      }

      return cb(null, savedReference);
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
