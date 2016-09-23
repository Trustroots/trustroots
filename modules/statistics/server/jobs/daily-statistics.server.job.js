'use strict';

/**
 * Task that collects daily statistics and sends them to InfluxDB
 */

/**
 * Module dependencies.
 */
var path = require('path'),
    config = require(path.resolve('./config/config')),
    influxService = require(path.resolve('./modules/core/server/services/influx.server.service')),
    statistics = require(path.resolve('./modules/statistics/server/controllers/statistics.server.controller'));

module.exports = function(job, agendaDone) {

  statistics.getUsersCount(function(err, count) {

    if (err) {
      console.error('Daily statistics: failed fetching user count.');
      console.error(err);
      return agendaDone(err);
    }

    // Save to influx here
    influxService.writePoint('members', count, { members: 'members' }, function(err) { // removed result from callback function because of ESLint complains
      if (err) {
        // InfluxDB was not enabled, don't scream out error
        if (config.influxdb || !config.influxdb.enabled) {
          console.log('Skipped storing daily statistics: no InfluxDB configured.');
          // Let `agendaDone()` succeed
          err = null;
        } else {
          console.error('Daily statistics: failed writing to InfluxDB.');
          console.error(err);
        }
      }
      agendaDone(err);
    });
  });

};
