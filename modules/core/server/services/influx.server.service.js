'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    Influx = require('influx'),
    _ = require('lodash'),
    config = require(path.resolve('./config/config')),
    log = require(path.resolve('./config/lib/logger'));

/**
 * Get InfluxDB Client
 */
exports.getClient = function(callback) {

  // Check that influxdb is enabled and that we have a host and database value.
  var enabled = _.get(config, 'influxdb.enabled');
  var host = _.get(config, 'influxdb.options.host');
  var database = _.get(config, 'influxdb.options.database');

  var isNotConfigured = enabled !== true || _.isUndefined(host) || _.isUndefined(database);
  if (isNotConfigured) {
    return callback(new Error('No InfluxDB configured.'));
  }

  // Init Influx client with configuration
  var client = new Influx.InfluxDB(config.influxdb.options);

  callback(null, client);
};

/**
 * Write measurement to InfluxDB
 *
 * fields - object of field key: value pairs. To save to influxdb.
 *   - key in camelCase
 *   - value - string or number (other options?)
 * You can specify time by passing a property called time (default: now)
 *   - time should always be Date object.
 * tags - object of tag key: value pairs. To save to influxdb
 *   - key in camelCase
 *   - value should be string or will be casted to string
 * don't forget to adjust the time precision accordingly. The default value is `ms`.
 *
 * @param {string} measurementName - measurement name as will be saved in
 * influxdb (camelCase)
 * @param {Object} fields - key: value pairs will be saved in influxdb as field
 * key: field value
 * @param {number|Date} [fields.time=new Date()] - time of measurement
 * @param {Object} tags - key: value pairs will be saved in influxdb as tag key:
 * tag value
 * @param {function} callback - expected to be like function (err, result) {}
 */
exports.writeMeasurement = function(measurementName, fields, tags, callback) {

  var errorMessage;

  if (!measurementName || typeof measurementName !== 'string'
    || measurementName.length === 0) {
    errorMessage = 'InfluxDB Service: no `measurementName` defined. #ghi3kH';
    // Log the failure
    log('error', errorMessage);
    return callback(new Error(errorMessage));
  }

  if (!_.isPlainObject(fields)) {
    errorMessage = 'InfluxDB Service: no `fields` defined. #ghugGJ';
    // Log the failure
    log('error', errorMessage, {
      measurement: measurementName
    });
    return callback(new Error(errorMessage));
  }

  if (!_.isPlainObject(tags)) {
    errorMessage = 'InfluxDB Service: no `tags` defined. #ghj3ig';
    // Log the failure
    log('error', errorMessage, {
      measurement: measurementName
    });
    return callback(new Error(errorMessage));
  }

  if (!fields.time) {
    // Add current time to `fields` if it's missing
    fields.time = new Date().getTime();
  } else if (!_.isDate(fields.time)) {
    // Validate time: it should always be a `Date` object
    errorMessage = 'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh';
    // Log the failure
    log('error', errorMessage, {
      measurement: measurementName,
      time: fields.time
    });
    return callback(new Error(errorMessage));
  } else {
    // Turn Date object into an integer (ms precision)
    fields.time = fields.time.getTime();
  }

  exports.getClient(function(err, client) {
    if (err) {
      return callback(err);
    }

    client.writeMeasurement(measurementName, [
      {
        fields: fields,
        tags: tags
      }
    ])
    .then(function() {
      if (callback) callback();
    })
    .catch(function(err) {
      // Log the failure
      log('error', 'InfluxDB Service: Error while writing to InfluxDB #fj38hh', {
        error: err,
        measurement: measurementName,
        fields: fields,
        tags: tags
      });
    });

  });
};
