// @TODO Move `/modules/core/server/services/influx.server.service` here

// Take our custom `stat` object and send a point to InfluxDB
var stat = function(stat) {
  var name = stat.namespace

  // If stat contains a time, we need to add it
  var timeExtend = stat.time ? {time: stat.time} : {}

  // InfluxDB handles complex, multi value data points, so we simply combine all
  // of meta, values, counts, and then add the time (which InfluxDB accepts as a
  // value).
  var fields = _.extend({}, meta, values, counts, timeExtend)
  var tags = stats.tags

  influx.writePoint(name, fields, tags)
}

// Public exports
exports.stat = stat

// Pseudo-private exports for tests
