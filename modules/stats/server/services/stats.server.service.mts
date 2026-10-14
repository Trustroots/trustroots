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

import _ from 'lodash';
import influxService from './influx.server.service.mts';

/**
 * The object which stats api .stat method expects as parameter.
 *
 * At least one of counts or values must be provided. Counts are summed and
 * values are averaged. Tags separate stat points into subsets and should have
 * a limited amount of possible values. Meta is non-essential data that only
 * some stat services save.
 *
 * {
 *   namespace: 'testStat',
 *   counts: { count1: 1, count2: 3 },
 *   values: { value1: 3.51, value2: 7.24 },
 *   tags: { tag1: 'value1', tag2: 'value2' },
 *   meta: { meta1: 'value1', meta2: 12.5 },
 *   time: new Date('1999-09-09 9:09:09.999')
 * }
 */
export type StatObject = {
  namespace: string;
  counts?: Record<string, number>;
  values?: Record<string, number>;
  tags?: Record<string, string | number | undefined>;
  meta?: Record<string, unknown>;
  time?: Date;
};

type StatCallback = (error?: Error | null) => void;

/**
 * Record a simple "count" stat
 * The callback is the last argument (2nd, 3rd or 4th). Count defaults to 1.
 */
function count(
  name: string,
  countOrCallback?: number | StatCallback,
  timeOrCallback?: Date | StatCallback,
  callback?: StatCallback,
) {
  let count = countOrCallback;
  let time = timeOrCallback;

  // make the count optional and callback as the last argument
  if (arguments.length === 2 && typeof count === 'function') {
    callback = count;
    count = undefined;
  }

  // make the time optional and callback as the last argument
  if (arguments.length === 3 && typeof time === 'function') {
    callback = time;
    time = undefined;
  }

  const statObject: StatObject = {
    namespace: name,
    counts: {
      count: (count as number | undefined) || 1,
    },
  };
  if (time) {
    statObject.time = time as Date;
  }
  stat(statObject, callback || function () {});
}

/**
 * Record a simple "value" stat
 * The callback is the last argument (3rd or 4th).
 */
function value(
  name: string,
  value: number,
  timeOrCallback?: Date | StatCallback,
  callback?: StatCallback,
) {
  let time = timeOrCallback;

  // make the time optional
  if (arguments.length === 3 && typeof time === 'function') {
    callback = time;
    time = undefined;
  }

  const statObject: StatObject = {
    namespace: name,
    values: {
      value,
    },
  };
  if (time) statObject.time = time as Date;
  stat(statObject, callback || function () {});
}

/**
 * Ensure that `stat` matches the required schema
 * An error will be thrown if stat object is invalid
 */
function validateStat(stat: StatObject) {
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
  function areKeysUnique(...objects: unknown[]) {
    // keys is an array of arrays of keys of all objects passed as arguments
    // to the function
    const keys: string[][] = [];
    let keyLength = 0;
    for (const object of objects) {
      const currentKeys = _.keys(object);
      keys.push(currentKeys);
      keyLength += currentKeys.length;
    }
    const unionKeys = _.union(...keys);
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
 * Deliver a complex stat and wait for backend acknowledgement
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
 */
function deliver(stat: StatObject, callback: StatCallback) {
  // validateStat will throw an error if invalid
  try {
    validateStat(stat); // Wrap in if() or make it throw depend on implementation
  } catch (err) {
    return callback(err as Error);
  }

  // You can add other stats services here
  influxService.stat(stat, callback);
}

// Request telemetry is best effort. Background jobs can use deliver() when
// acknowledgement matters. Cap outstanding writes during a backend outage.
let outstandingWrites = 0;
function stat(point: StatObject, callback: StatCallback = function () {}) {
  try {
    validateStat(point);
  } catch (err) {
    return callback(err as Error);
  }
  if (outstandingWrites < 32) {
    outstandingWrites += 1;
    const release = _.once(function () {
      outstandingWrites -= 1;
    });
    try {
      influxService.stat(point, release);
    } catch {
      release();
    }
  }
  // This acknowledges local validation, not remote persistence.
  return callback();
}

// Public exports
export { count, value, stat, deliver };

// Pseudo-private exports for tests
export const _validateStat = validateStat;
const statsService = {
  count,
  value,
  stat,
  deliver,
  _validateStat,
};
export default statsService;
export { statsService as 'module.exports' };
