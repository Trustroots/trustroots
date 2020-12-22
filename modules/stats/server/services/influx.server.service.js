/**
 * Module dependencies.
 */
const path = require('path');
const Influx = require('influx');
const _ = require('lodash');
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));

/**
 * Get InfluxDB Client
 */
const getClient = function (callback) {
  // Check that influxdb is enabled and that we have a host and database value.
  const enabled = _.get(config, 'influxdb.enabled');
  const host = _.get(config, 'influxdb.options.host');
  const database = _.get(config, 'influxdb.options.database');

  const isNotConfigured =
    enabled !== true || _.isUndefined(host) || _.isUndefined(database);
  if (isNotConfigured) {
    return callback(new Error('No InfluxDB configured.'));
  }

  // Init Influx client with configuration
  const client = new Influx.InfluxDB(config.influxdb.options);

  callback(null, client);
};

/**
 * Write measurement to InfluxDB
 *
 * fields - object of field_key: value pairs. To save to influxdb.
 *   - key in camelCase
 *   - value - string or number (other options?)
 * You can specify time by passing a property called time (default: now)
 *   - time should always be Date object.
 * tags - object of tag_key: value pairs. To save to influxdb
 *   - key in camelCase
 *   - value should be string or will be casted to string
 * don't forget to adjust the time precision accordingly. The default value is `ms`.
 *
 * @param {string} measurementName - measurement name as will be saved in
 * influxdb (camelCase)
 * @param {Object} fields - key: value pairs to be saved in influxdb as fields
 * @param {Date} [fields.time] - optional time of the measurement
 * @param {number|Date} [fields.time=new Date()] - time of measurement
 * @param {Object} tags - key: value pairs will be saved in influxdb as tag_key:
 * tag_value
 * @param {function} callback - expected to be like function (err, result) {}
 */
const writeMeasurement = function (measurementName, fields, tags, callback) {
  let errorMessage;

  if (!measurementName || !_.isString(measurementName)) {
    errorMessage = 'InfluxDB Service: no `measurementName` defined. #ghi3kH';
    // Log the failure
    log('error', errorMessage);
    return callback(new Error(errorMessage));
  }

  if (!_.isPlainObject(fields)) {
    errorMessage = 'InfluxDB Service: no `fields` defined. #ghugGJ';
    // Log the failure
    log('error', errorMessage, {
      measurement: measurementName,
    });
    return callback(new Error(errorMessage));
  }

  if (!_.isPlainObject(tags)) {
    errorMessage = 'InfluxDB Service: no `tags` defined. #ghj3ig';
    // Log the failure
    log('error', errorMessage, {
      measurement: measurementName,
    });
    return callback(new Error(errorMessage));
  }

  // the point is the IPoint we'll send to node-influx's writeMeasurement
  const point = {
    fields,
    tags,
  };

  // deal with the time
  if (fields.time) {
    // Validate time: it should always be a `Date` object
    if (!_.isDate(fields.time)) {
      errorMessage =
        'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh';
      // Log the failure
      log('error', errorMessage, {
        measurement: measurementName,
        time: fields.time,
      });

      // callback with error
      return callback(new Error(errorMessage));
    }

    // move the time (Date) from fields to point.timestamp
    point.timestamp = fields.time;
    delete fields.time;
  }

  exports._getClient(function (err, client) {
    if (err) {
      return callback(err);
    }

    client
      .writeMeasurement(measurementName, [point])
      .then(function () {
        if (callback) return callback();
      })
      .catch(function (err) {
        // Log the failure
        log(
          'error',
          'InfluxDB Service: Error while writing to InfluxDB #fj38hh',
          {
            error: err,
            measurement: measurementName,
            fields,
            tags,
          },
        );

        return callback(err);
      });
  });
};

/**
 * The object which stats api .stat method expects as parameter
 * @typedef {Object} StatObject
 * @property {string} namespace - the name, identifier of the stat point
 * @property {Object} [counts] - object of a shape { <count1>: number, ... }
 * We care about a sum of the numbers in statistics. At least one of counts or values must be provided.
 * @property {Object} [values] - object of a shape { <value1>: number, ... }
 * We care about an average of the numbers in statistics. At least one of counts or values must be provided.
 * @property {Object} [tags] - object of a shape { <tag1>: string|number, ... }
 * Tags separate stat points into subsets based on a limited amount of tag values
 * There should be limited amount of tags with limited amount of possible values
 * @property {Object} [meta] - object of a shape { <meta1>: string| number, ... }
 * Meta contains non-essential data, which will be saved only to some stat services
 * Meta will be saved into influx, not into stathat.
 * All string values which are not tags should go to meta.
 * @property {Date} [time] - time of the point if it is specified
 *
 * {
 *   namespace: 'testStat',
 *   counts: {
 *     count1: 1,
 *     count2: 3
 *   },
 *   values: {
 *     value1: 3.51,
 *     value2: 7.24
 *   },
 *   tags: {
 *     tag1: 'value1',
 *     tag2: 'value2'
 *   },
 *   meta: {
 *     meta1: 'value1',
 *     meta2: 12.5
 *   },
 *   time: new Date('1999-09-09 9:09:09.999')
 * }
 */

/**
 * Take the `stat` object and format it for the writeMeasurement function
 * The writeMeasurement function will finalize formatting the data to the form
 * required by influxdb.writeMeasurement (IPoint).
 * @param {StatObject} stat
 * @param {Function} callback
 *
 */
const stat = function (stat, callback) {
  // when influxdb is disabled, log info and finish without error
  const enabled = _.get(config, 'influxdb.enabled');
  if (!enabled) {
    return callback();
  }

  const namespace = stat.namespace;
  const meta = stat.meta;
  const values = stat.values;
  const counts = stat.counts;
  const tags = stat.tags || {};

  // If stat contains a time, we need to add it
  const timeExtend = stat.time ? { time: stat.time } : {};

  // the name of the measurement.
  // we rename 'messages' to stay compatible with older influxdb points
  // TODO let's decide whether to keep the old name or make a new standard
  const name = namespace === 'messages' ? 'messageSent' : namespace;

  // InfluxDB handles complex, multi value data points, so we simply combine all
  // of meta, values, counts and time.
  // We will move the time (optional) from (influx) IPoint.fields to
  // IPoint.timestamp in the writeMeasurement function.
  const fields = _.extend({}, meta, values, counts, timeExtend);

  writeMeasurement(name, fields, tags, callback);
};

// Public exports
exports.stat = stat;

// Pseudo-private exports for tests
exports._getClient = getClient;
exports._writeMeasurement = writeMeasurement;
