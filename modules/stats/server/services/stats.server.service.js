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
const _ = require('lodash');
// path = require('path'),
// config = require(path.resolve('./config/config')),
const influxService = require('./influx.server.service.js');

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
 * @callback statCallback
 * @param {Error} error
 */

/**
 * Record a simple "count" stat
 * @param {string} name - stat name
 * @param {number} [count] - stat value, default 1
 * @param {Date} [time]
 * @param {statCallback} callback - last argument (2nd, 3rd or 4th)
 */
function count(name, count, time, callback) {
  // make the count optional and callback as the last argument
  if (arguments.length === 2 && _.isFunction(count)) {
    callback = count;
    count = undefined;
  }

  // make the time optional and callback as the last argument
  if (arguments.length === 3 && _.isFunction(time)) {
    callback = time;
    time = undefined;
  }

  // set the defaults
  count = count || 1;
  callback = callback || function () {};

  const statObject = {
    namespace: name,
    counts: {
      count,
    },
  };

  if (time) {
    statObject.time = time;
  }

  stat(statObject, callback);
}

/**
 * Record a simple "value" stat
 * @param {string} name - stat name
 * @param {number} value - stat value
 * @param {Date} [time]
 * @param {statCallback} callback - last argument (3rd or 4th)
 */
function value(name, value, time, callback) {
  // make the time optional
  if (arguments.length === 3 && _.isFunction(time)) {
    callback = time;
    time = undefined;
  }

  // set default callback
  callback = callback || function () {};

  // construct and send the stat
  const statObject = {
    namespace: name,
    values: {
      value,
    },
  };

  if (time) statObject.time = time;

  stat(statObject, callback);
}

/**
 * Ensure that `stat` matches the required schema
 * An error will be thrown if stat object is invalid
 * @param {StatObject} stat - the stat object
 * @returns {void}
 */
function validateStat(stat) {
  // We must have a value called namespace and it must be a string
  if (!_.isString(stat.namespace)) {
    // error
    throw new Error('The stat.namespace should be a string');
  }

  // We must have at least one of `counts` or `values`, or both
  const isCountsAndValuesMissing =
    _.isUndefined(stat.counts) && _.isUndefined(stat.values);
  // @TODO check that they are plain objects or undefined with _.isPlainObject()
  // counts or values have to contain at least 1 property
  const isCountsAndValuesEmpty =
    _.keys(stat.counts).length + _.keys(stat.values).length === 0;
  if (isCountsAndValuesMissing || isCountsAndValuesEmpty) {
    // error
    throw new Error('The stat should contain counts or values');
  }

  // Every key in `counts`, `values`, `meta`, and `tags` must be unique
  // We fetch all the keys and then compare length of their union with
  // the sum of their lengths. If the lengths are equal, all keys are unique.
  function areKeysUnique() {
    // keys is an array of arrays of keys of all objects passed as arguments
    // to the function
    const keys = [];
    let keyLength = 0;

    for (let i = 0, len = arguments.length; i < len; i++) {
      const currentKeys = _.keys(arguments[i]);
      keys.push(currentKeys);
      keyLength += currentKeys.length;
    }

    const unionKeys = _.union.apply(this, keys);

    return keyLength === unionKeys.length;
  }

  if (!areKeysUnique(stat.counts, stat.values, stat.meta, stat.tags)) {
    throw new Error(
      'Every key of stat counts, values, meta and tags must be unique',
    );
  }

  // Every value in 'counts' and 'values' should be a number
  const vals = _.concat(_.values(stat.counts), _.values(stat.values));

  const areNumbers = _.every(vals, _.isNumber);

  if (!areNumbers) {
    throw new Error('Each of counts and values should be a number');
  }

  // time, if provided, should be of type Date
  if (_.has(stat, 'time') && !_.isDate(stat.time)) {
    throw new Error('Time must be a Date object or not provided');
  }
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
 *
 * @param {StatObject} stat
 * @param {statCallback} callback
 */
function stat(stat, callback) {
  // validateStat will throw an error if invalid
  try {
    validateStat(stat); // Wrap in if() or make it throw depend on implementation
  } catch (err) {
    return callback(err);
  }

  // You can add other stats services here
  influxService.stat(stat, callback);
}

// Public exports
exports.count = count;
exports.value = value;
exports.stat = stat;

// Pseudo-private exports for tests
exports._validateStat = validateStat;
