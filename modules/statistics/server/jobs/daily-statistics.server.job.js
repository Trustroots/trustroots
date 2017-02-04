'use strict';

/**
 * Task that collects daily statistics and sends them to InfluxDB
 */

/**
 * Module dependencies.
 */
var path = require('path'),
    statsService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    statistics = require(path.resolve('./modules/statistics/server/controllers/statistics.server.controller'));

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
        console.error('Daily statistics: failed writing to some endpoints.');

        if (err.message === 'Writing to Influx or Stathat service failed.') {
          if (err.errors && err.errors.influx) {
            console.error('Daily statistics: failed writing to influx');
            console.error(err.errors.influx);
          }
          if (err.errors && err.errors.stathat) {
            console.error('Daily statistics: failed writing to stathat');
            console.error(err.errors.stathat);
          }

          // when the job fails writing to an endpoint, we probably don't want
          // to retry, because writing to the non-failing one would be duplicate
          // @TODO decide this better
          err = null;
        } else {
          console.error(err);
        }
      }

      agendaDone(err);
    });
  });
};
