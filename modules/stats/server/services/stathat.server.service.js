'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    config = require(path.resolve('./config/config')),
    stathat = require('stathat');

// Get the stathat key from `config`
var key = _.get(config, 'stathat.key', false)

// We use this to separate the parts of names in our stats
var SEPARATOR = '.'

if (!key) {
  console.error('No stathat key #LDoC3y')
}

// The stathat API accepts a callback, we pass an empty function for now
// @TODO Improve stathat error handling
var callback = function() {}

// If `time` is a Date object, then return a unix timestamp (which is what
// stathat wants to consume), otherwise, return the value unmodified.
var formatTime = function(time) {
  if (_.isDate(time)) {
    return time.getTime() / 1000
  } else {
    return time
  }
}

// Combine parts of a name with a separator
var buildName = function() {
  return Array.prototype.slice.call(arguments).join(SEPARATOR)
}

// Choose the correct stathat method and send the metric.
var send = function(type, name, value, time) {
  // If we don't have a stathat key, silently drop this stat
  if (!key) {
    return
  }

  // Select the stathat method we want to use
  var method = type === 'count' ? 'trackEZCount' : 'trackEZValue'

  // Build an array of arguments for the method's `.apply()` below
  var args = [key, name, value]

  // If there is a date, prepend `WithTime` to the method name, and add the
  // formatted `time`  to the arguments array.
  if (_.isDate(time)) {
    method += 'WithTime'
    args.push(formatTime(time))
  }

  // Add the callback to the arguments array
  args.push(callback)

  // Call the stathat method
  stathat[method].apply(stathat, args)
}

// Process one stat sending one value for the stat itself, and one value for
// every tag.
var sendStats = function(type, statName, statValue, tags, time) {
  // Send a stat
  send(type, statName, statValue, time)

  // Iterate over the tags and send one stat per tag
  _.eachObject(tags, function(tagName, tagValue) {
    send(type, buildName(statName, tagName, tagValue), statValue, time)
  })
}

// Take our custom `stat` object and send stat(s) to stathat
var stat = function(stat) {
  var namespace = stat.namespace
  var tags = stats.tags
  var counts = stat.counts
  var values = stat.values

  // Iterate over the `counts`
  _.eachObject(counts, function(countName, value) {
    // Process this counter
    sendStats('count', buidName(namespace, countName), value, tags, time)
  })

  // Iterate over the `values`
  _.eachObject(counts, function(valueName, value) {
    // Process this value
    sendStats('value', buildName(namespace, valueName), value, tags, time)
  })
}

// Public exports
exports.stat = stat

// Pseudo-private exports for tests
exports._formatTime = formatTime
exports._buildName = buildName
exports._send = send
