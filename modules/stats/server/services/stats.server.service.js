'use strict';

/**
 * Stats
 *
 * We support 3 types of statistics (stats).
 *
 * The first is count. A count is a single event that happens. For example, a
 * user logs in, a new member signs up, a message is sent, etc. These stats are
 * typically aggregated with functions like `SUM()`.
 *
 * The second is value. A value is the measurement of something at a point in
 * time. For example, how many members we have, how many items are in a queue,
 * how long it took for a user to reply to a message, etc. These stats are
 * typically aggregated with functions like `MEAN()`.
 *
 * The third is a more complex combination of the two. It's designed to be
 * implementation agnostic, so we can record stats in a standardised way and
 * push them to arbitrary backends. It can contain a combination of both counts
 * and values.
 *
 * Each of these stat types is supported by a function of the same name
 * (`count()`, `value()`, `stat()`). Usage is documented below.
 */

/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    config = require(path.resolve('./config/config'));

/**
  * Record a simple "count" stat
 */
var count = function(name, count = 1, time) {
  return stat({
    namespace: name,
    counts: {
      count,
    },
    time,
  })
}

/**
 * Record a simple "value" stat
 */
var value = function(name, value, time) {
  return stat({
    namespace: name,
    values: {
      value,
    }
    time,
  })
}

// Ensure that `stat` matches the required schema
var validateStat = function(stat) {
  // We must have a value called namespace and it must be a string
  if (!_.isString(stat.namespace)) {
    // error
  }

  // We must have at least one of `counts` or `values`, or both
  if (_.isUndefined(stats.counts) && _.isUndefined(stats.values)) {
    // error
  }

  // Every key in `counts`, `values`, `meta`, and `tags` must be unique
  // @TODO Implement this check
}

/**
 * Record a complex stat
 *
 * Example usage and documentation of the propeties:

stats.stat({
  // The `namespace` will generally be the base name for the statistic, to which
  // the `key`s from `counts` and `values` will generally be appended. So a key
  // like `messages` with a count like `sent: 1` will normally result in a stat
  // name like `messages.sent`.
  namespace: 'messages',
  // These will be logged a counts. There can be multiple values in the format
  // `key: count` where `key` must be a string and `count` must be an integer.
  // The most common case is for `count` to equal 1.
  counts: {
    sent: 1,
  },
  // These will be logged as values. There can be multiple values in the format
  // `key: value`, `key` must be a string and `value` must be a number (float
  // or integer).
  values: {
    timeToFirstReply: 2*60*1000,
  },
  // These are tags which provide greater context to a stat. These are optional
  // should be kept to a minimum (2 is a sensible upper limit). Note that they
  // are pairs of `key: value` and both `key` and `value` should be strings.
  tags: {
    position: 'firstMessage' || 'firstReply',
    messageLengthType: 'long' || 'short',
  },
  // These additional fields will be logged only by backends that support
  // arbitrarily complex stats. It is not guaranteed that these will be sent to
  // all backends (they are ignored by stathat for example), so you should only
  // store non critical data in them. There can be multiple values in the format
  // `key: value` where `key` must be a string and value can be any primitive
  // type (string, integer, float, Date, boolean).
  meta: {
    messageId,
    userFrom,
    userTo,
    messageLength,
  },
  // The time at which the stat should be measured. This is optional, and if
  // set, must be a Date.
  // NOTE: Not all backends support stats with dates, so you should avoid using
  // this unless absolutely necessary. Any backend which does not support a
  // `time` will silently drop the stat.
  time: new Date(),
})

 *
 * NOTE: One of either `values` or `counts` must exist, and a single key should
 * only be used one in any of the properties (`counts`, `values`, `tags`,
 * `meta`).
 */
stat = function(stat) {
  validateStat(stat) // Wrap in if() or make it throw depend on implementation
  sendToInflux(stat)
  sendToStathat(stat)
}

// Public exports
exports.count = count
exports.value = value
exports.stat = stat

// Pseudo-private exports for tests
exports._validateStat = validateStat
