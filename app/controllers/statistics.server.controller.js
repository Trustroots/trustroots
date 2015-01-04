'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors'),
    async = require('async'),
    git = require('git-rev'),
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
      User
        .find({public:true})
        .count(function(err, count) {
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
      },
      function(err, count) {
        req.statistics.hosting = count;
        done(err);
      });
    },

    // Returns: 'git rev-parse HEAD'
    // @link https://www.npmjs.com/package/git-rev
    function(done) {
      git.long(function (hash) {
        req.statistics.commit = hash;
        done(null);
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
