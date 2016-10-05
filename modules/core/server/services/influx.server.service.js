'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    influx = require('influx'),
    _ = require('lodash'),
    config = require(path.resolve('./config/config'));

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

  // check passed so we send configuration to influx()
  callback(null, influx(config.influxdb.options));
};

/**
 * Write point to InfluxDB
 *
 * fields - object of field key: value pairs. To save to influxdb.
 *   - key in camelCase
 *   - value - string or number (other options?)
 * You can specify time by passing a property called time (default: now)
 *   - time can either be an integer (default ms) or a date object.
 * tags - object of tag key: value pairs. To save to influxdb
 *   - key in camelCase
 *   - value should be string or will be casted to string
 * don't forget to adjust the time precision accordingly. The default value is `ms`.
 *
 * @param {string} measurementName - measurement name as will be saved in
 * influxdb (camelCase)
 * @param {Object} fields - key: value pairs will be saved in influxdb as field
 * key: field value
 * @param {number|Date} [fields.time=new Date()] - time of measurement with precision ms
 * @param {Object} tags - key: value pairs will be saved in influxdb as tag key:
 * tag value
 * @param {function} callback - expected to be like function (err, result) {}
 */
exports.writePoint = function(measurementName, fields, tags, callback) {

  if (!measurementName || typeof measurementName !== 'string'
    || measurementName.length === 0) {
    return callback(new Error('InfluxDB Service: no `measurementName` defined.'));
  }

  if (!_.isPlainObject(fields)) {
    return callback(new Error('InfluxDB Service: no `fields` defined.'));
  }

  if (!_.isPlainObject(tags)) {
    return callback(new Error('InfluxDB Service: no `tags` defined.'));
  }

  // Add current time to `fields` if it's missing
  if (!fields.time) {
    fields.time = new Date();
  }

  exports.getClient(function(err, client) {
    if (err) {
      return callback(err);
    }

    client.writePoint(measurementName, fields, tags, callback);
  });
};
