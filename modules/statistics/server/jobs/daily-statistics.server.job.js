'use strict';

/**
 * Task that collects daily statistics and sends them to InfluxDB
 */

/**
 * Module dependencies.
 */
var path = require('path'),
    influxService = require(path.resolve('./modules/stats/server/services/influx.server.service')),
    statistics = require(path.resolve('./modules/statistics/server/controllers/statistics.server.controller'));

module.exports = function (job, agendaDone) {

  statistics.getUsersCount(function (err, count) {

    if (err) {
      console.error('Daily statistics: failed fetching user count.');
      console.error(err);
      return agendaDone(err);
    }

    // Save to influx here
    // @TODO remake for a general Stats API
    influxService._writeMeasurement('members', { count: count }, { members: 'members' },
      function (err, result) {
        if (err) {
          console.error('Daily statistics: failed writing to InfluxDB.');
          console.error(err);
        }
        result; // satisfy ESLint unused variables
        agendaDone(err);
      });
  });
};
