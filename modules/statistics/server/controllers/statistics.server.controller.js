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
 * Get count of all public users
 */
exports.getUsersCount = function(callback) {
  User.count({ public: true }, function(err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, count || 0);
  });
};

/**
 * Get count of all public users
 */
exports.getExternalSiteCount = function(site, callback) {
  var validSites = ['bewelcome', 'couchsurfing', 'warmshowers', 'facebook', 'twitter', 'github'];

  // Validate site
  if (!site || validSites.indexOf(site) === -1) {
    return callback(new Error('Missing external site id.'));
  }

  // Build the query
  var query = { public: true };

  switch (site) {
    case 'bewelcome':
      query.extSitesBW = { $exists: true, $ne: '' };
      break;
    case 'couchsurfing':
      query.extSitesCS = { $exists: true, $ne: '' };
      break;
    case 'warmshowers':
      query.extSitesWS = { $exists: true, $ne: '' };
      break;
    case 'facebook':
      query.additionalProvidersData = {
        facebook: { $exists: true }
      };
      break;
    case 'twitter':
      query.additionalProvidersData = {
        twitter: { $exists: true }
      };
      break;
    case 'github':
      query.additionalProvidersData = {
        github: { $exists: true }
      };
      break;
  }

  User.count(query, function(err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, count || 0);
  });
};

/**
 * Get count of hosting offers
 * Callback will be called with Object `{ yes: Int, maybe: Int }`
 */
exports.getOffersCount = function(callback) {
  Offer.aggregate({
    $group: {
      _id: '$status',
      count: { $sum: 1 }
    }
  },
  function(err, counters) {
    if (err) {
      callback(err);
      return;
    }
    var values = {
      yes: 0,
      maybe: 0
    };
    if (counters && counters.length > 0) {
      counters.forEach(function(counter) {
        if (['yes', 'maybe'].indexOf(counter._id) !== -1) {
          values[counter._id] = counter.count || 0;
        }
      });
    }
    callback(null, values);
  });
};

/**
 * Get count of newsletter subscriptions
 */
exports.getNewsletterSubscriptionsCount = function(callback) {
  User.count({
    newsletter: true,
    public: true
  },
  function(err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, count || 0);
  });
};


/**
 * Get all statistics
 */
exports.getPublicStatistics = function(req, res) {

  req.statistics = {
    connected: {},
    hosting: {}
  };

  async.waterfall([

    // Total users
    function(done) {
      exports.getUsersCount(function(err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.total = count;
        done();
      });
    },

    // External sites - BeWelcome
    function(done) {
      exports.getExternalSiteCount('bewelcome', function(err, count) {
        req.statistics.connected.bewelcome = count;
        done(err);
      });
    },

    // External sites - Couchsurfing
    function(done) {
      exports.getExternalSiteCount('couchsurfing', function(err, count) {
        req.statistics.connected.couchsurfing = count;
        done(err);
      });
    },

    // External sites - Warmshowers
    function(done) {
      exports.getExternalSiteCount('warmshowers', function(err, count) {
        req.statistics.connected.warmshowers = count;
        done(err);
      });
    },

    // External sites - Facebook
    function(done) {
      exports.getExternalSiteCount('facebook', function(err, count) {
        req.statistics.connected.facebook = count;
        done(err);
      });
    },

    // External sites - Twitter
    function(done) {
      exports.getExternalSiteCount('twitter', function(err, count) {
        req.statistics.connected.twitter = count;
        done(err);
      });
    },

    // External sites - GitHub
    function(done) {
      exports.getExternalSiteCount('github', function(err, count) {
        req.statistics.connected.github = count;
        done(err);
      });
    },

    // Newsletter subscribers
    function(done) {
      exports.getNewsletterSubscriptionsCount(function(err, count) {
        req.statistics.newsletter = count;
        done(err);
      });
    },

    // Hosting stats
    function(done) {
      exports.getOffersCount(function(err, counter) {
        req.statistics.hosting.yes = counter.yes;
        req.statistics.hosting.maybe = counter.maybe;
        done(err);
      });
    },

    // Returns: 'git rev-parse HEAD'
    // @link https://www.npmjs.com/package/git-rev
    function(done) {
      git.long(function (hash) {
        req.statistics.commit = hash || '';
        done(null);
      });
    },

    // Done!
    function() {
      return res.json(req.statistics);
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
