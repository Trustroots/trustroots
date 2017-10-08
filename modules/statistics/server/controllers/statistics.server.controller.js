'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    async = require('async'),
    git = require('git-rev'),
    mongoose = require('mongoose'),
    Offer = mongoose.model('Offer'),
    User = mongoose.model('User');

/**
 * Get count of all public users
 */
exports.getUsersCount = function (callback) {
  User.count({ public: true }, function (err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of all public users
 */
exports.getExternalSiteCount = function (site, callback) {
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
      query['additionalProvidersData.facebook'] = { $exists: true };
      break;
    case 'twitter':
      query['additionalProvidersData.twitter'] = { $exists: true };
      break;
    case 'github':
      query['additionalProvidersData.github'] = { $exists: true };
      break;
  }

  User.count(query, function (err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of all public users
 */
exports.getMeetOffersCount = function (callback) {
  Offer.count({ type: 'meet' }, function (err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of hosting offers
 * Callback will be called with Object `{ yes: Int, maybe: Int, no: Int }`
 */
exports.getHostOffersCount = function (callback) {
  Offer.aggregate([
    {
      $match: {
        type: 'host'
      }
    },
    {
      $group: {
        _id: '$status',
        count: {
          $sum: 1
        }
      }
    }
  ],
  function (err, counters) {
    if (err) {
      callback(err);
      return;
    }

    // the returned counters is expected to be an array of a form
    //
    // [
    //   {
    //     _id: 'yes',
    //     count: number // amount of 'yes' offers
    //   },
    //   {
    //     _id: 'maybe',
    //     count: number // amount of 'maybe' offers
    //   },
    //   {
    //     _id: 'no',
    //     count: number // amount of 'no' offers
    //   }
    // ]
    var values = {
      yes: 0,
      maybe: 0,
      no: 0
    };

    if (counters && counters.length > 0) {
      counters.forEach(function (counter) {
        if (['yes', 'maybe', 'no'].indexOf(counter._id) !== -1) {
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
exports.getNewsletterSubscriptionsCount = function (callback) {
  User.count({
    newsletter: true,
    public: true
  },
  function (err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of registered push notifications
 */
exports.getPushRegistrationCount = function (callback) {
  User.count({
    public: true,
    pushRegistration: {
      $exists: true,
      // `pushRegistration` array should not be empty
      $not: { $size: 0 }
    }
  }, function (err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get all statistics
 */
exports.getPublicStatistics = function (req, res) {

  req.statistics = {
    connected: {},
    hosting: {}
  };

  async.waterfall([

    // Total users
    function (done) {
      exports.getUsersCount(function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.total = count;
        done();
      });
    },

    // External sites - BeWelcome
    function (done) {
      exports.getExternalSiteCount('bewelcome', function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.connected.bewelcome = count;
        done();
      });
    },

    // External sites - Couchsurfing
    function (done) {
      exports.getExternalSiteCount('couchsurfing', function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.connected.couchsurfing = count;
        done();
      });
    },

    // External sites - Warmshowers
    function (done) {
      exports.getExternalSiteCount('warmshowers', function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.connected.warmshowers = count;
        done();
      });
    },

    // External sites - Facebook
    function (done) {
      exports.getExternalSiteCount('facebook', function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.connected.facebook = count;
        done();
      });
    },

    // External sites - Twitter
    function (done) {
      exports.getExternalSiteCount('twitter', function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.connected.twitter = count;
        done();
      });
    },

    // External sites - GitHub
    function (done) {
      exports.getExternalSiteCount('github', function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.connected.github = count;
        done();
      });
    },

    // Newsletter subscribers
    function (done) {
      exports.getNewsletterSubscriptionsCount(function (err, count) {
        if (err) {
          return done(err);
        }
        req.statistics.newsletter = count;
        done();
      });
    },

    // Hosting stats
    function (done) {
      exports.getHostOffersCount(function (err, counter) {
        if (err) {
          return done(err);
        }
        req.statistics.hosting.yes = counter.yes;
        req.statistics.hosting.maybe = counter.maybe;
        done();
      });
    },

    // Returns: 'git rev-parse HEAD'
    // @link https://www.npmjs.com/package/git-rev
    function (done) {
      git.long(function (hash) {
        req.statistics.commit = hash || '';
        done(null);
      });
    },

    // Done!
    function () {
      return res.json(req.statistics);
    }

  ],
  function (err) {
    if (err) {
      res.status(400).send({
        message: errorService.getErrorMessage(err)
      });
    }
  });
};
