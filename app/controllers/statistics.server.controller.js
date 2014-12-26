'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors'),
    async = require('async'),
    Offer = mongoose.model('Offer'),
    User = mongoose.model('User');

/**
 * Get all statistics
 */
exports.get = function(req, res) {

  req.statistics = {};

  async.waterfall([

    // Total users
    function(done) {
      User.count(function(err, count) {
        req.statistics.total = count;
        done(err);
      });
    },

    // Hosting stats
    function(done) {
      Offer.count({
        $or: [
          { status: 'yes' },
          { status: 'maybe' }
        ]
      }, function(err, count) {
        req.statistics.hosting = count;
        done(err);
      });
    },

    // Done!
    function(done) {
      res.json(req.statistics);
    }

  ],
  function(err) {
    if (err) {
      res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
};
