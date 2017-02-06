'use strict';

/**
 * Task that collects daily statistics and sends them to Stats API
 */

/**
 * Module dependencies.
 */
var path = require('path'),
    statsService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    statistics = require(path.resolve('./modules/statistics/server/controllers/statistics.server.controller')),
    log = require(path.resolve('./config/lib/logger'));

module.exports = function (job, agendaDone) {

  statistics.getUsersCount(function (err, count) {

    if (err) {
      console.error('Daily statistics: failed fetching user count.');
      console.error(err);
      return agendaDone(err);
    }

    // Save to influx and stathat via Stats api
    statsService.stat({
      namespace: 'members',
      values: {
        count: count
      },
      tags: {
        members: 'members'
      }
    }, function (err, result) { // eslint-disable-line no-unused-vars
      if (err) {
        // if there exist stat-service specific errors, log them separately
        if (err.message === 'Writing to Influx or Stathat service failed.') {
          if (err.errors && err.errors.influx) {
            log('error', 'Daily statistics: failed writing to influx', err.errors.influx);
          }
          if (err.errors && err.errors.stathat) {
            log('error', 'Daily statistics: failed writing to stathat', err.errors.stathat);
          }

          // when the job fails writing to an endpoint, we probably don't want
          // to retry, because writing to the non-failing one would be duplicate
          // @TODO decide this better
          err = null; // don't fail
        } else {
          // log a general error
          log('error', 'Daily statistics: failed writing to some endpoints.', err);
        }
      }

      agendaDone(err);
    });
  });
};
