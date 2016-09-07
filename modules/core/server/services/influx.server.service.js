'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    influx = require('influx'),
    config = require(path.resolve('./config/config'));

/**
 * Get InfluxDB Client
 */
exports.getClient = function(callback) {
  if (!config.influxdb ||
      !config.influxdb.enabled ||
      !config.influxdb.options ||
      !config.influxdb.options.host ||
      !config.influxdb.options.database) {
    return callback(new Error('No InfluxDB configured.'));
  }
  callback(null, influx(config.influxdb.options));
};

/**
 * Write point to InfluxDB
 *
 * `values` can be either an object or a single value. For the latter the columname is set to value.
 * You can set the time by passing an object propety called time. The time an be either an integer value or a Date object.
 * When providing a single value, don't forget to adjust the time precision accordingly. The default value is `ms`.
 */
exports.writePoint = function(seriesName, values, tags, callback) {

  if (!seriesName || typeof seriesName !== 'string' || seriesName.length === 0) {
    return callback(new Error('InfluxDB Service: no `seriesName` defined.'));
  }

  if (values === undefined || values === null) {
    return callback(new Error('InfluxDB Service: no `values` defined.'));
  }

  if (!tags || typeof tags !== 'object') {
    return callback(new Error('InfluxDB Service: no `tags` defined.'));
  }

  // Turn `values` into object so that we can add time if it's missing
  if (typeof values !== 'object') {
    values = {
      value: values
    };
  }

  // Add current time to `values` if it's missing
  if (!values.time) {
    values.time = new Date();
  }

  exports.getClient(function(err, client) {
    if (err) {
      return callback(err);
    }

    // `callback` will return `function (err, response)`
    client.writePoint(seriesName, values, tags, callback);
  });
};
