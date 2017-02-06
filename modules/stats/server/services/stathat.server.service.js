'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    async = require('async'),
    stathat = require('stathat'),
    config = require(path.resolve('./config/config')),
    log = require(path.resolve('./config/lib/logger'));

// send data to stathat.com over https (ecrypted)
stathat.useHTTPS = true;

// Get the stathat key from `config`
var key = _.get(config, 'stathat.key', false);

// We use this to separate the parts of names in our stats
var SEPARATOR = '.';

if (!key) {
  log('error', 'No stathat key #LDoC3y');
}

/**
 * Format time. If `time` is a Date object, then return a unix timestamp
 * (which is what stathat wants to consume), otherwise error.
 * @param {Date} time
 * @returns {number} - the given time converted to unix timestamp [seconds]
 */
var formatTime = function(time) {
  if (_.isDate(time)) {
    return time.getTime() / 1000;
  } else {
    throw new Error('Time, if provided, needs to be a Date object');
  }
};

/**
 * Combine parts of a name with a separator
 * @param {string} arguments - function accepts one or multiple strings
 * @returns {string} - the built name (arguments separated by SEPARATOR)
 */
var buildName = function () {
  return Array.prototype.slice.call(arguments).join(SEPARATOR);
};

/**
 * Choose the correct stathat method and send the metric.
 * @param {string} type - 'count' or 'value', select a stathat method
 * @param {string} name - name of the metric
 * @param {number} value - value of the metric
 * @param {Date|undefined} time - time of the metric
 * @param {Function} callback
 * @returns void
 */
var send = function(type, name, value, time, callback) {
  // Get a fresh stathat key from `config` (maybe it was stubbed since the instantiation of this module)
  var key = _.get(config, 'stathat.key', false);
  // If we don't have a stathat key, silently drop this stat
  if (!key) {
    return callback();
  }

  // Available stathat methods:
  // trackEZCount, trackEZValue, trackEZCountWithTime, trackEZValueWithTime

  // Select the stathat method we want to use
  var method = (type === 'count') ? 'trackEZCount' : 'trackEZValue';

  // Build an array of arguments for the method's `.apply()` below
  var args = [key, name, value];

  // If there is a date, prepend `WithTime` to the method name, and add the
  // formatted `time`  to the arguments array.
  if (_.isDate(time)) {
    method += 'WithTime';
    args.push(formatTime(time));
  }

  // Add the callback to the arguments array
  args.push(callback);

  // Call the stathat method
  stathat[method].apply(stathat, args);
};

/**
 * Create one metric untagged
 * Create one metric for each tag provided
 * We do it by attaching the tagname and value to the metric name using buildName()
 * @param {string} type - 'count' or 'value', select a stathat method
 * @param {string} statName - name of the metric
 * @param {number} statValue - value of the metric
 * @param {Object} tags - { tag1: 'value1', tag2: 'value2', ... }
 * @param {Date|undefined} time - time of the metric
 * @param {Function} callback
 */
var sendStats = function(type, statName, statValue, tags, time, callback) {

  // collect the statNames (the default one and the ones created from tags)
  var statNames = [[statName]];
  _.forOwn(tags, function (tagValue, tagName) {
    statNames.push([buildName(statName, tagName, tagValue)]);
  });

  asyncEachFinish(statNames, function (statName, done) {
    send(type, statName, statValue, time, done);
  }, callback);

};

/**
 * Format the stat object to data points and send the data points to stathat
 * @param {Object} stat
 * @param {string} stat.namespace
 * @param {Object} [stat.counts] - object of countName: <number> pairs
 * @param {Object} [stat.values] - object of valueName: <number> pairs; at least
 * one count or value must be provided
 * @param {Object} [stat.tags] - object of tagname: <string|number> pairs
 * @param {Date} [stat.time] - time of the data point
 * @param {Function} callback
 */
var stat = function(stat, callback) {

  // if stathat is disabled, log the info and quit without failing
  var isEnabled = _.get(config, 'stathat.enabled', false);
  if (!isEnabled) {
    log('warn', 'Stathat is disabled.');
    return callback();
  }

  var namespace = stat.namespace;
  var tags = stat.tags;
  var counts = stat.counts;
  var values = stat.values;
  var time = stat.time;

  // Iterate over the `counts`
  var sendStatsParams = [];
  _.forOwn(counts, function(value, countName) {
    // Process this counter
    sendStatsParams.push(['count', buildName(namespace, countName), value, tags, time]);
  });

  // Iterate over the `values`
  _.forOwn(values, function(value, valueName) {
    // Process this value
    sendStatsParams.push(['value', buildName(namespace, valueName), value, tags, time]);
  });

  asyncEachFinish(sendStatsParams, sendStats, callback);
};

// Public exports
exports.stat = stat;

// Pseudo-private exports for tests
exports._formatTime = formatTime;
exports._buildName = buildName;
exports._send = send;


/**
 * This is a wrapper of async.each, which modifies its behaviour:
 * We want the functionality of async.each, but we don't want to finish on error.
 * We want to run iteratee on all coll's elements, collect the errors and
 * present them (if any) at the end.
 * @param {Array<Array<any>>} coll -  array of arrays of arguments for iteratee
 * @param {Function} iteratee -
 * @param {Function} callback
 */
function asyncEachFinish(coll, iteratee, callback) {
  // collect errors here
  var sendErrors = [];

  /**
   * Calls the iteratee with an array of arguments.
   * If an error occurs, pushes it to sendErrors array and doesn't fail.
   * @param {Array<any>} args - array of arguments for iteratee
   * @param {Function} done - callback function
   */
  function errorCollectingIteratee(args, done) {
    var toRun = iteratee.bind.apply(iteratee, [null].concat(args));

    toRun(function (e) {
      // collect any errors to sendErrors array
      if (e) {
        e.args = args;
        sendErrors.push(e);
      }

      return done();
    });
  }

  /**
   * Collects the errors (if any) and calls callback.
   */
  function cb (e) {
    if (e) return callback(e);

    if (sendErrors.length > 0) {
      var responseError = new Error('Collected ' + sendErrors.length + '/' + coll.length + 'failures. See property errors');

      responseError.errors = sendErrors;

      return callback(responseError);
    }

    return callback();
  }

  // run async.each using the functions defined above
  async.each(coll, errorCollectingIteratee, cb);
}
