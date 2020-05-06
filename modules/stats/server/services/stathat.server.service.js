/**
 * Module dependencies.
 */
const path = require('path');
const _ = require('lodash');
const async = require('async');
const stathat = require('stathat');
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));

// send data to stathat.com over https (ecrypted)
stathat.useHTTPS = true;

// Get the stathat key from `config`
const key = _.get(config, 'stathat.key', false);

// We use this to separate the parts of names in our stats
const SEPARATOR = '.';

if (!key) {
  log('error', 'No stathat key #LDoC3y');
}

/**
 * Format time. If `time` is a Date object, then return a unix timestamp
 * (which is what stathat wants to consume), otherwise error.
 * @param {Date} time
 * @returns {number} - the given time converted to unix timestamp [seconds]
 */
const formatTime = function (time) {
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
const buildName = function () {
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
const send = function (type, name, value, time, callback) {
  // Get a fresh stathat key from `config` (maybe it was stubbed since the instantiation of this module)
  const key = _.get(config, 'stathat.key', false);
  // If we don't have a stathat key, silently drop this stat
  if (!key) {
    return callback();
  }

  // Available stathat methods:
  // trackEZCount, trackEZValue, trackEZCountWithTime, trackEZValueWithTime

  // Select the stathat method we want to use
  let method = type === 'count' ? 'trackEZCount' : 'trackEZValue';

  // Build an array of arguments for the method's `.apply()` below
  const args = [key, name, value];

  // If there is a date, prepend `WithTime` to the method name, and add the
  // formatted `time`  to the arguments array.
  if (_.isDate(time)) {
    method += 'WithTime';
    args.push(formatTime(time));
  }

  // Add the callback to the arguments array
  args.push(processResponse(callback));

  // Call the stathat method
  stathat[method].apply(stathat, args);
};

/**
 * Stathat callback, the callback which stathat.trackEZ(Count|Value)[WithTime]
 * expects as a last parameter
 *
 * @callback stathatCallback
 * @param {number} code - the response code or 600
 * @param {string} [errorMessage] - the error message, only if code === 600
 * @param {Buffer} responseBody - the stathat response body
 */

/**
 * Process the callback arguments from stathat, then call node-like callback
 *
 * According to https://github.com/FGRibreau/node-stathat/blob/29f18aa1dcb0b60bc945d94ba20f4e1c9d76fcca/main.js
 * (which is hopefully the same as the npm stathat package)
 * Stathat.prototype.postRequest(), the callback gets called with following
 * argumets:
 * on error: f(600, err.message, body)
 * without error: f(response.statusCode, body)
 * Therefore first we check arguments.length: 3 = error, 2 = no error
 * On error & code 600 => push the error
 * On code 2xx => Success
 * On code 3xx => Redirect?? probably not happening
 * On code 4xx => Client error: an error here. Log and fix.
 * On code 5xx => Server error: Log and maybe TODO retry in the future.
 *
 * @param {Function} callback - callback with optional error as a first argument
 * @returns {stathatCallback}
 */
function processResponse(callback) {
  return function (code) {
    const argLen = arguments.length;

    // response body
    let body;

    try {
      if (argLen === 3 && code === 600) {
        body = arguments[2];
        // take care of the error
        const errorMessage = arguments[1];
        throw new Error(errorMessage);
      } else if (argLen === 2) {
        body = arguments[1];

        // check various response codes and log errors
        const codeGroup = parseInt(code / 100, 10);

        switch (codeGroup) {
          case 2:
            // OK, no error
            break;
          case 3:
            // Redirect, unexpected.
            throw new Error(
              'Stathat responded with code 3xx (redirect) unexpectedly.',
            );
          case 4:
            // Client error
            throw new Error('Stathat responded with code 4xx (client error).');
          case 5:
            // Server error
            throw new Error('Stathat responded with code 5xx (server error).');
          default:
            throw new Error('Stathat responded with unexpected status code.');
        }
      } else {
        // this should not happen
        throw new Error('Unexpected response from stathat.');
      }
    } catch (e) {
      // collect any errors to sendErrors array
      e.statusCode = code;
      e.responseBody = body;
      return callback(e);
    }

    return callback();
  };
}

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
const sendStats = function (type, statName, statValue, tags, time, callback) {
  // collect the statNames (the default one and the ones created from tags)
  const statNames = [[statName]];
  _.forOwn(tags, function (tagValue, tagName) {
    statNames.push([buildName(statName, tagName, tagValue)]);
  });

  asyncEachFinish(
    statNames,
    function (statName, done) {
      send(type, statName, statValue, time, done);
    },
    callback,
  );
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
const stat = function (stat, callback) {
  // if stathat is disabled, log the info and quit without failing
  const isEnabled = _.get(config, 'stathat.enabled', false);
  if (!isEnabled) {
    return callback();
  }

  const namespace = stat.namespace;
  const tags = stat.tags;
  const counts = stat.counts;
  const values = stat.values;
  const time = stat.time;

  // Iterate over the `counts`
  const sendStatsParams = [];
  _.forOwn(counts, function (value, countName) {
    // Process this counter
    sendStatsParams.push([
      'count',
      buildName(namespace, countName),
      value,
      tags,
      time,
    ]);
  });

  // Iterate over the `values`
  _.forOwn(values, function (value, valueName) {
    // Process this value
    sendStatsParams.push([
      'value',
      buildName(namespace, valueName),
      value,
      tags,
      time,
    ]);
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
  const sendErrors = [];

  /**
   * Calls the iteratee with an array of arguments.
   * If an error occurs, pushes it to sendErrors array and doesn't fail.
   * @param {Array<any>} args - array of arguments for iteratee
   * @param {Function} done - callback function
   */
  function errorCollectingIteratee(args, done) {
    // bind the iteratee's arguments to iteratee
    const toRun = iteratee.bind.apply(iteratee, [null].concat(args));

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
  function cb(e) {
    if (e) return callback(e);

    if (sendErrors.length > 0) {
      const responseError = new Error(
        'Collected ' +
          sendErrors.length +
          '/' +
          coll.length +
          ' failures. See property errors',
      );

      responseError.errors = sendErrors;

      return callback(responseError);
    }

    return callback();
  }

  // run async.each using the functions defined above
  async.each(coll, errorCollectingIteratee, cb);
}
