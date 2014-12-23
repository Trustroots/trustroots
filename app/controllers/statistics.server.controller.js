'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors'),
    User = mongoose.model('User');

/**
 * Get all statistics
 */
exports.get = function(req, res) {
  User.count(function(err, count) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
    req.statistics = {};
    req.statistics.total = count;
    res.json(req.statistics);
  });
};
