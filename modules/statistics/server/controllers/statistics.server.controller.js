/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const moment = require('moment');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const async = require('async');
const semver = require('semver');
const mongoose = require('mongoose');
const Offer = mongoose.model('Offer');
const User = mongoose.model('User');

/**
 * Get count of all public users
 */
exports.getUsersCount = function (callback) {
  User.countDocuments({ public: true }, function (err, count) {
    if (err) {
      return callback(err);
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of all public users
 */
exports.getExternalSiteCount = function (site, callback) {
  const validSites = [
    'bewelcome',
    'couchsurfing',
    'warmshowers',
    'facebook',
    'twitter',
    'github',
  ];

  // Validate site
  if (!site || validSites.indexOf(site) === -1) {
    return callback(new Error('Missing external site id.'));
  }

  // Build the query
  const query = { public: true };

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

  User.countDocuments(query, function (err, count) {
    if (err) {
      return callback(err);
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of all public users
 */
exports.getMeetOffersCount = function (callback) {
  Offer.countDocuments(
    {
      type: 'meet',
      $or: [
        { validUntil: { $gte: new Date() } },
        { validUntil: { $exists: false } },
      ],
    },
    function (err, count) {
      if (err) {
        return callback(err);
      }
      callback(null, parseInt(count, 10) || 0);
    },
  );
};

/**
 * Get count of hosting offers
 * Callback will be called with Object `{ yes: Int, maybe: Int, no: Int }`
 */
exports.getHostOffersCount = function (callback) {
  Offer.aggregate(
    [
      {
        $match: {
          type: 'host',
        },
      },
      {
        $group: {
          _id: '$status',
          count: {
            $sum: 1,
          },
        },
      },
    ],
    function (err, counters) {
      if (err) {
        return callback(err);
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
      const values = {
        yes: 0,
        maybe: 0,
        no: 0,
      };

      if (counters && counters.length > 0) {
        counters.forEach(function (counter) {
          if (['yes', 'maybe', 'no'].indexOf(counter._id) !== -1) {
            values[counter._id] = parseInt(counter.count, 10) || 0;
          }
        });
      }

      callback(null, values);
    },
  );
};

/**
 * Get count of newsletter subscriptions
 */
exports.getNewsletterSubscriptionsCount = function (callback) {
  User.countDocuments(
    {
      newsletter: true,
      public: true,
    },
    function (err, count) {
      if (err) {
        return callback(err);
      }
      callback(null, parseInt(count, 10) || 0);
    },
  );
};

/**
 * Get count of registered push notifications
 */
exports.getPushRegistrationCount = function (callback) {
  User.countDocuments(
    {
      public: true,
      pushRegistration: {
        $exists: true,
        // `pushRegistration` array should not be empty
        $not: { $size: 0 },
      },
    },
    function (err, count) {
      if (err) {
        return callback(err);
      }
      callback(null, parseInt(count, 10) || 0);
    },
  );
};

/**
 * Generate statistics based on the user last seen attribute
 */
exports.getLastSeenStatistic = function (since, callback) {
  const query = {
    seen: {
      $gte: moment().subtract(since).toDate(),
    },
  };

  User.countDocuments(query, function (err, count) {
    if (err) {
      return callback(err);
    }
    callback(null, parseInt(count, 10) || 0);
  });
};

/**
 * Get count of languages users speak
 *
 * @param limit {int} Limit returned number of languages
 * @param callback {function}
 */
exports.getUserLanguagesCount = function (limit, callback) {
  User.aggregate(
    [
      { $unwind: '$languages' },
      {
        $group: {
          _id: '$languages',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ],
    callback,
  );
};

/**
 * Get all statistics
 */
exports.getPublicStatistics = function (req, res) {
  req.statistics = {
    connections: [],
    hosting: {},
  };

  async.waterfall(
    [
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

          req.statistics.connections.push({
            network: 'bewelcome',
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          });
          done();
        });
      },

      // External sites - Couchsurfing
      function (done) {
        exports.getExternalSiteCount('couchsurfing', function (err, count) {
          if (err) {
            return done(err);
          }
          req.statistics.connections.push({
            network: 'couchsurfing',
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          });
          done();
        });
      },

      // External sites - Warmshowers
      function (done) {
        exports.getExternalSiteCount('warmshowers', function (err, count) {
          if (err) {
            return done(err);
          }
          req.statistics.connections.push({
            network: 'warmshowers',
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          });
          done();
        });
      },

      // External sites - Facebook
      function (done) {
        exports.getExternalSiteCount('facebook', function (err, count) {
          if (err) {
            return done(err);
          }
          req.statistics.connections.push({
            network: 'facebook',
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          });
          done();
        });
      },

      // External sites - Twitter
      function (done) {
        exports.getExternalSiteCount('twitter', function (err, count) {
          if (err) {
            return done(err);
          }
          req.statistics.connections.push({
            network: 'twitter',
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          });
          done();
        });
      },

      // External sites - GitHub
      function (done) {
        exports.getExternalSiteCount('github', function (err, count) {
          if (err) {
            return done(err);
          }
          req.statistics.connections.push({
            network: 'github',
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          });
          done();
        });
      },

      // Newsletter subscribers
      function (done) {
        exports.getNewsletterSubscriptionsCount(function (err, count) {
          if (err) {
            return done(err);
          }
          req.statistics.newsletter = {
            count,
            percentage: Math.round((count / req.statistics.total) * 100),
          };
          done();
        });
      },

      // Hosting stats
      function (done) {
        exports.getHostOffersCount(function (err, counter) {
          if (err) {
            return done(err);
          }

          const totalHosting = counter.yes + counter.maybe;

          req.statistics.hosting = {
            total: totalHosting,
            percentage: Math.round((totalHosting / req.statistics.total) * 100),
            yes: counter.yes,
            yesPercentage: Math.round((counter.yes / totalHosting) * 100),
            maybe: counter.maybe,
            maybePercentage: Math.round((counter.maybe / totalHosting) * 100),
          };

          done();
        });
      },

      // Done!
      function () {
        return res.json(req.statistics);
      },
    ],
    function (err) {
      if (err) {
        res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
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
  const collection = String(_.get(req, 'body.collection', ''));

  const validCollections = ['mobileAppInit'];

  const updateMsg =
    'You should update Trustroots app or otherwise it will not continue functioning.';

  if (!_.has(req, 'body.stats') || !_.isObject(req.body.stats)) {
    res.header('x-tr-update-needed', updateMsg).status(400).send({
      message: 'Missing or invalid `stats`.',
    });
  }

  if (!collection || validCollections.indexOf(collection) === -1) {
    res.header('x-tr-update-needed', updateMsg).status(400).send({
      message: 'Missing or invalid `collection`.',
    });
  }

  if (collection === 'mobileAppInit') {
    const appVersion = String(_.get(req, 'body.stats.version', 'unknown'));
    const needsUpdate = semver.satisfies(appVersion, '< 1.0.0');

    // Object for statistics
    const stats = {
      namespace: 'mobileAppInit',
      counts: {
        count: 1,
      },
      tags: {
        // Trustroots app version (e.g. "0.2.0")
        version: appVersion,
        // Device year class, e.g. "2012"
        // @link https://github.com/facebook/device-year-class
        deviceYearClass: String(
          _.get(req, 'body.stats.deviceYearClass', 'unknown'),
        ),
      },
      meta: {
        // Device OS (e.g. "android")
        os: String(_.get(req, 'body.stats.os', 'unknown')),
        // Expo SDK version
        expoVersion: String(_.get(req, 'body.stats.expoVersion', 'unknown')),
      },
    };

    // Send validation result to stats
    statService.stat(stats, function () {
      // Add update header if app version so requires
      if (needsUpdate) {
        return res
          .header('x-tr-update-needed', updateMsg)
          .json({ message: updateMsg });
      }

      return res.json({ message: 'OK' });
    });
  }
};
