'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    stathat = require('stathat');

// send data to stathat.com over https (ecrypted)
stathat.useHTTPS = true;

// Get the stathat key from `config`
var key = _.get(config, 'stathat.key', false);

// We use this to separate the parts of names in our stats
var SEPARATOR = '.';

if (!key) {
  console.error('No stathat key #LDoC3y');
}

// If `time` is a Date object, then return a unix timestamp (which is what
// stathat wants to consume), otherwise, return the value unmodified.
var formatTime = function(time) {
  if (_.isDate(time)) {
    return time.getTime() / 1000;
  } else {
    return time;
  }
};

// Combine parts of a name with a separator
var buildName = function () {
  return Array.prototype.slice.call(arguments).join(SEPARATOR);
};

// Choose the correct stathat method and send the metric.
var send = function(type, name, value, time, callback) {
  // Get a fresh stathat key from `config` (maybe it was stubbed since the instantiation of this module)
  var key = _.get(config, 'stathat.key', false);
  // If we don't have a stathat key, silently drop this stat
  if (!key) {
    return callback();
  }

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

// Process one stat sending one value for the stat itself, and one value for
// every tag.
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

// Take our custom `stat` object and send stat(s) to stathat
var stat = function(stat, callback) {
  // check that stathat is enabled
  var isEnabled = _.get(config, 'stathat.enabled', false);

  if (!isEnabled) {
    return callback(new Error('Stathat is disabled.'));
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


// we want the functionality of async.each, but we don't want to finish on error
// we want to run iteratee on all coll's elements, collect the errors and
// present them (if any) at the end
// also coll should be array of arrays of arguments for iteratee
function asyncEachFinish(coll, iteratee, callback) {
  // collect errors here
  var sendErrors = [];

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

  function cb (e) {
    if (e) return callback(e);

    if (sendErrors.length > 0) {
      var responseError = new Error('Collected ' + sendErrors.length + '/' + coll.length + 'failures. See property errors');

      responseError.errors = sendErrors;

      return callback(responseError);
    }

    return callback();
  }

  // iterate over all statNames and send each to stathat
  async.each(coll, errorCollectingIteratee, cb);
}
