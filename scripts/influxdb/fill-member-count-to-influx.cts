import type {
  MemberCountAsync,
  DayGroup,
  AggregatedDayGroup,
  ConnectionHelper,
  CountUsers,
  LegacyMongoose,
} from '../legacy-cli-contracts.d.cts';
const _ = require('lodash') as typeof import('lodash');
const async = require('async') as MemberCountAsync;
const moment = require('moment') as typeof import('moment');
const mongooseService =
  require('./../../config/lib/mongoose.mjs') as ConnectionHelper;
const mongoose = require('mongoose') as LegacyMongoose;
const statsService =
  require('./../../modules/stats/server/services/stats.server.service.mts') as typeof import('../../modules/stats/server/services/stats.server.service.mts').default;

require('./../../modules/users/server/models/user.server.model.mjs');
const User = mongoose.model<CountUsers>('User');

let cumulativeUserCount = 0;

const aggregateGrouping = {
  $group: {
    // _id : { month: { $month: "$created" }, day: { $dayOfMonth: "$created" }, year: { $year: "$created" }  },
    _id: {
      month: { $month: '$created' },
      day: { $dayOfMonth: '$created' },
      year: { $year: '$created' },
      dayOfYear: { $dayOfYear: '$created' },
    },
    count: { $sum: 1 },
  },
};

const whereQuery = {
  public: true,
  created: { $lt: new Date('2016-10-11T00:00:00Z') },
};
const aggregateMatch = { $match: whereQuery };
const aggregateSort = {
  $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
};

const enumerateDaysBetweenDates = function (startDate: Date, endDate: Date) {
  const dates: Date[] = [];

  const currDate = moment(startDate).clone().startOf('day').add(1, 'day');
  const lastDate = moment(endDate).clone().startOf('day').add(1, 'day');

  while (currDate.add(1, 'days').diff(lastDate) < 0) {
    // console.log(currDate.toDate());
    dates.push(currDate.clone().toDate());
  }

  return dates;
};

async.waterfall(
  [
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
    User.aggregate<AggregatedDayGroup>([
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
      User.countDocuments(whereQuery).then(
        function (usersCount) {
          console.log('Found ' + usersCount + ' users currently in the DB.\n');
          done(null, usersCount);
        },
        function (err) {
          done(err, 0);
        },
      );
    },

    function (usersCount, done) {
      // Aggregate from mongodb
      User.aggregate<AggregatedDayGroup>([
        aggregateMatch,
        aggregateGrouping,
        aggregateSort,
      ]).then(
        function (cursor) {
          done(null, cursor, usersCount);
        },
        function (err) {
          done(err, [], 0);
        },
      );
    },

    // Add missing dates
    function (cursor, usersCount, done) {
      console.log('Filling missing days from aggregated array.\n');

      const dates: DayGroup[] = [];
      let prevDayOfYear: number | false = false;
      let prevDay: number | false = false;
      let prevMonth: number | false = false;
      let prevYear: number | false = false;

      async.eachOfSeries(
        cursor,
        function (group, index, callback) {
          if (
            prevDayOfYear !== false &&
            (prevYear !== group._id.year ||
              prevDayOfYear + 1 !== group._id.dayOfYear)
          ) {
            // var prevDayDiff = group._id.dayOfYear - prevDayOfYear;
            const startDate = new Date(
              Number(prevYear),
              Number(prevMonth) - 1,
              Number(prevDay),
            );
            const endDate = new Date(
              group._id.year,
              group._id.month - 1,
              group._id.day,
            );
            const prevDayDiffArr = enumerateDaysBetweenDates(
              startDate,
              endDate,
            );

            prevDayDiffArr.forEach(function (date) {
              dates.push({
                _id: {
                  year: date.getFullYear(),
                  month: date.getMonth() + 1,
                  day: date.getDate(),
                },
                count: 0,
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
        },
        function (err) {
          return done(err, dates, dates.length, usersCount);
        },
      );
    },
    function findAndProcessUsers(dates, daysCount, usersCount, done) {
      console.log('Processing and adding daily counters to Influx...\n');

      // preparation for async.doWhilst function
      //
      // settings how often the progress will be printed to console
      // every PROGRESS_INTERVAL %
      const PROGRESS_INTERVAL = 0.1; // percent
      let progress = 0; // progress counter

      // getting the next message from mongodb
      async.eachOfSeries(
        dates,
        function (countGroup, index, callback) {
          // showing a progress
          if (
            progress % Math.ceil((daysCount / 100) * PROGRESS_INTERVAL) ===
            0
          ) {
            // update the progress instead of logging to newline
            const progressPercent = ((progress / daysCount) * 100).toFixed(1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(
              progressPercent + '% (' + progress + '/' + daysCount + ' days)',
            );
          }
          cumulativeUserCount = cumulativeUserCount + countGroup.count;
          ++progress;

          // console.log('\n  -> TO INFLUX: ' + cumulativeUserCount + ' [+' + countGroup.count + '] (' + countGroup._id.year + '-' + countGroup._id.month + '-' + countGroup._id.day + ')')

          // processing and saving the point to database
          statsService.stat(
            {
              namespace: 'test_members',
              values: {
                count: parseInt(String(cumulativeUserCount), 10),
              },
              tags: {
                members: 'members',
              },
              // JavaScript counts months from 0 to 11. January is 0. December is 11.
              time: new Date(
                parseInt(String(countGroup._id.year), 10),
                parseInt(String(countGroup._id.month), 10) - 1,
                parseInt(String(countGroup._id.day), 10),
              ),
            },
            function (err) {
              return callback(err);
            },
          );
        },
        function (err) {
          return done(err, progress, daysCount, usersCount);
        },
      );
    },

    // finish writing the progress bar
    function (progress, daysCount, usersCount, done) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(
        Math.floor((progress / daysCount) * 100) +
          '% (' +
          progress +
          '/' +
          daysCount +
          ' days)\n' +
          '- Cumulative user count: ' +
          cumulativeUserCount +
          '\n' +
          '- Counter to check against: ' +
          usersCount +
          '\n' +
          '\nDone!\n',
      );
      done(null);
    },

    // Disconnect DB
    function (done) {
      console.log('\nDisconnecting from Mongodb...');
      mongooseService.disconnect(function (err) {
        done(err);
      });
    },
  ],
  function (err) {
    if (err) {
      console.error('\nError:');
      console.error(err);
    }
    return; // all finished!
  },
);
