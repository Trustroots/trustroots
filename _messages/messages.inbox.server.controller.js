'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  errorHandler = require('../errors'),
  Thread = mongoose.model('Thread'),
  User = mongoose.model('User');


/**
 * List of threads aka inbox
 * @todo: pagination
 */
exports.inbox = function(req, res) {
  Thread.find(
      {
        $or: [
          { userFrom: req.user },
          { userTo: req.user }
        ]
      }
    )
    .sort('updated')
    .populate('userFrom', 'displayName')
    .populate('userTo', 'displayName')
    .populate('message', 'content')
    .exec(function(err, threads) {
      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {
        res.jsonp(threads);
      }
    });
};

