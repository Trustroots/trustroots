'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    async = require('async'),
    git = require('git-rev'),
    mongoose = require('mongoose'),
    Offer = mongoose.model('Offer'),
    User = mongoose.model('User');

/**
 * Get all statistics
 */
exports.get = function(req, res) {

  req.statistics = {
    connected: {},
    hosting: {}
  };

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

    // External sites - BeWelcome
    function(done) {

      User.count({
        extSitesBW: { $exists: true, $ne: '' }
      }, function(err, count) {
        req.statistics.connected.bewelcome = (count ? count : 0);
        done(err);
      });
    },

    // External sites - Couchsurfing
    function(done) {
      User.count({
        extSitesCS: { $exists: true, $ne: '' }
      }, function(err, count) {
        req.statistics.connected.couchsurfing = (count ? count : 0);
        done(err);
      });
    },

    // External sites - Warmshowers
    function(done) {
      User.count({
        extSitesWS: { $exists: true, $ne: '' }
      }, function(err, count) {
        req.statistics.connected.warmshowers = (count ? count : 0);
        done(err);
      });
    },

    // External sites - Facebook
    function(done) {
      User.count({
        'additionalProvidersData.facebook': { $exists: true }
      }, function(err, count) {
        req.statistics.connected.facebook = (count ? count : 0);
        done(err);
      });
    },

    // External sites - Twitter
    function(done) {
      User.count({
        'additionalProvidersData.twitter': { $exists: true }
      }, function(err, count) {
        req.statistics.connected.twitter = (count ? count : 0);
        done(err);
      });
    },

    // External sites - GitHub
    function(done) {
      User.count({
        'additionalProvidersData.github': { $exists: true }
      }, function(err, count) {
        req.statistics.connected.github = (count ? count : 0);
        done(err);
      });
    },

    // Newsletter subscribers
    function(done) {
      User.count({
        newsletter: true
      },
      function(err, count) {
        req.statistics.newsletter = (count ? count : 0);
        done(err);
      });
    },

    // Hosting stats
    function(done) {
      Offer.aggregate({
        $group: {
            _id : '$status',
            count: { $sum: 1 }
        }
      },
      function(err, counters) {
        if(counters && counters.length > 0) {
          counters.forEach(function(counter) {
            if(['yes', 'maybe'].indexOf(counter._id) !== -1) {
              req.statistics.hosting[counter._id] = counter.count;
            }
          });
        }
        done(err);
      });
    },

    // Returns: 'git rev-parse HEAD'
    // @link https://www.npmjs.com/package/git-rev
    function(done) {
      git.long(function (hash) {
        req.statistics.commit = (hash ? hash : '');
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
