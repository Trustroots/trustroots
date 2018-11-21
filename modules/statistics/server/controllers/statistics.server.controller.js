'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    moment = require('moment'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    statService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    async = require('async'),
    git = require('git-rev'),
    semver = require('semver'),
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
  Offer.count({
    type: 'meet',
    $or: [
      { validUntil: { $gte: new Date() } },
      { validUntil: { $exists: false } }
    ]
  }, function (err, count) {
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
 * Generate statistics based on the user last seen attribute
 */
exports.getLastSeenStatistic = function (type, callback) {
  var now = moment();
  var query = { };
  var slideWindow;

  switch (type) {
    case 'past48h':
      slideWindow = now.subtract(48, 'hours');
      break;
    case 'past7d':
      slideWindow = now.subtract(7, 'days');
      break;
    case 'past14d':
      slideWindow = now.subtract(14, 'days');
      break;
    case 'past30d':
      slideWindow = now.subtract(30, 'days');
      break;
    case 'past6m':
      slideWindow = now.subtract(6, 'months');
      break;
    case 'past12m':
      slideWindow = now.subtract(12, 'months');
      break;
    default:
      return callback(new Error('Missing last seen statistic type.'));
  }

  query.seen = { '$gte': slideWindow };

  User.count(query, function (err, count) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, parseInt(count) || 0);
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

/**
 * Collect statistics
 *
 * Mobile apps should show "App needs update" if this route returns headers:
 * ```
 * {
 *   'x-tr-update-needed': 'Custom message to show to user.'
 * }
 * ```
 */
exports.collectStatistics = function (req, res) {

  var collection = String(_.get(req, 'body.collection', ''));

  var validCollections = ['mobileAppInit'];

  var updateMsg = 'You should update Trustroots app or otherwise it will not continue functioning.';

  if (!_.has(req, 'body.stats') || !_.isObject(req.body.stats)) {
    res
      .header('x-tr-update-needed', updateMsg)
      .status(400)
      .send({
        message: 'Missing or invalid `stats`.'
      });
  }

  if (!collection || validCollections.indexOf(collection) === -1) {
    res
      .header('x-tr-update-needed', updateMsg)
      .status(400)
      .send({
        message: 'Missing or invalid `collection`.'
      });
  }

  if (collection === 'mobileAppInit') {

    var appVersion = String(_.get(req, 'body.stats.version', 'unknown'));
    var needsUpdate = semver.satisfies(appVersion, '< 1.0.0');

    // Object for statistics
    var stats = {
      namespace: 'mobileAppInit',
      counts: {
        count: 1
      },
      tags: {
        // Trustroots app version (e.g. "0.2.0")
        version: appVersion,
        // Device year class, e.g. "2012"
        // @link https://github.com/facebook/device-year-class
        deviceYearClass: String(_.get(req, 'body.stats.deviceYearClass', 'unknown'))
      },
      meta: {
        // Device OS (e.g. "android")
        os: String(_.get(req, 'body.stats.os', 'unknown')),
        // Expo SDK version
        expoVersion: String(_.get(req, 'body.stats.expoVersion', 'unknown'))
      }
    };

    // Send validation result to stats
    statService.stat(stats, function () {

      // Add update header if app version so requires
      if (needsUpdate) {
        return res.header('x-tr-update-needed', updateMsg).json({ 'message': updateMsg });
      }

      return res.json({ 'message': 'OK' });
    });
  }
};
