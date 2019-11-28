var _ = require('lodash'),
    path = require('path'),
    async = require('async'),
    moment = require('moment'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    mongoose = require('mongoose'),
    statsService = require(path.resolve('./modules/stats/server/services/stats.server.service'));

require(path.resolve('./modules/users/server/models/user.server.model'));
var User = mongoose.model('User');

var cumulativeUserCount = 0;

var aggregateGrouping = { $group: {
  // _id : { month: { $month: "$created" }, day: { $dayOfMonth: "$created" }, year: { $year: "$created" }  },
  _id: {
    month: { $month: '$created' },
    day: { $dayOfMonth: '$created' },
    year: { $year: '$created' },
    dayOfYear: { $dayOfYear: '$created' }
  },
  count: { $sum: 1 }
} };

var whereQuery = {
  public: true,
  created: { $lt: new Date('2016-10-11T00:00:00Z') }
};
var aggregateMatch = { $match: whereQuery };
var aggregateSort = { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } };

var enumerateDaysBetweenDates = function (startDate, endDate) {
  var dates = [];

  var currDate = moment(startDate).clone().startOf('day').add(1, 'day');
  var lastDate = moment(endDate).clone().startOf('day').add(1, 'day');

  while (currDate.add(1, 'days').diff(lastDate) < 0) {
    // console.log(currDate.toDate());
    dates.push(currDate.clone().toDate());
  }

  return dates;
};


async.waterfall([

  // Bootstrap db connection
  function (done) {
    console.log('Connecting to Mongodb...');
    mongooseService.connect(function () {
      console.log('Connected to Mongodb.');
      done(null);
    });
  },

  // count all days to be able to show progress
  /*
  function(done) {
    User.aggregate([
      aggregateMatch,
      aggregateGrouping,
      { $group: { _id: null, count: { $sum: 1 } } }
    ]).exec(function (err, daysCount) {
      var daysCount = daysCount[0].count;
      console.log('Found ' + daysCount + ' aggregated days\n');
      done(err, daysCount);
    });
  },
  */

  function (done) {
    User.find(whereQuery).count().exec(function (err, usersCount) {
      console.log('Found ' + usersCount + ' users currently in the DB.\n');
      done(err, usersCount);
    });
  },

  function (usersCount, done) {
    // Aggregate from mongodb
    User.aggregate([
      aggregateMatch,
      aggregateGrouping,
      aggregateSort
    ], function (err, cursor) {
      done(err, cursor, usersCount);
    });

  },

  // Add missing dates
  function (cursor, usersCount, done) {

    console.log('Filling missing days from aggregated array.\n');

    var dates = [];
    var prevDayOfYear = false;
    var prevDay = false;
    var prevMonth = false;
    var prevYear = false;

    async.eachOfSeries(cursor, function (group, index, callback) {

      if (prevDayOfYear !== false && (prevYear !== group._id.year || prevDayOfYear+1 !== group._id.dayOfYear)) {
        if (prevYear !== group._id.year) {
        }

        // var prevDayDiff = group._id.dayOfYear - prevDayOfYear;
        var startDate = new Date(prevYear, prevMonth-1, prevDay);
        var endDate = new Date(group._id.year, group._id.month-1, group._id.day);
        var prevDayDiffArr = enumerateDaysBetweenDates(startDate, endDate);

        prevDayDiffArr.forEach(function (date) {
          dates.push({
            _id: {
              year: date.getFullYear(),
              month: date.getMonth() + 1,
              day: date.getDate()
            },
            count: 0
          });
        });

      }

      // Set prev counters
      prevDayOfYear = _.clone(group._id.dayOfYear);
      prevDay = _.clone(group._id.day);
      prevMonth = _.clone(group._id.month);
      prevYear = _.clone(group._id.year);

      dates.push(group);

      callback();

    }, function (err) {
      return done(err, dates, dates.length, usersCount);
    });
  },
  function findAndProcessUsers(dates, daysCount, usersCount, done) {

    console.log('Processing and adding daily counters to Influx...\n');

    // preparation for async.doWhilst function
    //
    // settings how often the progress will be printed to console
    // every PROGRESS_INTERVAL %
    var PROGRESS_INTERVAL = 0.1; // percent
    var progress = 0; // progress counter

    // getting the next message from mongodb
    async.eachOfSeries(dates, function (countGroup, index, callback) {

      // showing a progress
      if (progress % Math.ceil(daysCount / 100 * PROGRESS_INTERVAL) === 0) {
        // update the progress instead of logging to newline
        var progressPercent = (progress / daysCount * 100).toFixed(1);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(progressPercent + '% (' + progress + '/' + daysCount + ' days)');
      }
      cumulativeUserCount = cumulativeUserCount + countGroup.count;
      ++progress;

      // console.log('\n  -> TO INFLUX: ' + cumulativeUserCount + ' [+' + countGroup.count + '] (' + countGroup._id.year + '-' + countGroup._id.month + '-' + countGroup._id.day + ')')

      // processing and saving the point to database
      statsService.stat(
        {
          namespace: 'test_members',
          values: {
            count: parseInt(cumulativeUserCount, 10)
          },
          tags: {
            members: 'members'
          },
          // JavaScript counts months from 0 to 11. January is 0. December is 11.
          time: new Date(parseInt(countGroup._id.year, 10), parseInt(countGroup._id.month, 10) - 1, parseInt(countGroup._id.day, 10))
        },
        function (err) {
          return callback(err);
        }
      );

    }, function (err, result) { // eslint-disable-line no-unused-vars
      return done(err, progress, daysCount, usersCount);
    });
  },

  // finish writing the progress bar
  function (progress, daysCount, usersCount, done) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(
      Math.floor(progress / daysCount * 100) + '% (' + progress + '/' + daysCount + ' days)\n' +
      '- Cumulative user count: ' + cumulativeUserCount + '\n' +
      '- Counter to check against: ' + usersCount + '\n' +
      '\nDone!\n'
    );
    done(null);
  },

  // Disconnect DB
  function (done) {
    console.log('\nDisconnecting from Mongodb...');
    mongooseService.disconnect(function (err) {
      done(err);
    });
  }

], function (err) {
  if (err) {
    console.error('\nError:');
    console.error(err);
  }
  return; // all finished!
});
