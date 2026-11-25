import type {
  DayGroup,
  AggregatedDayGroup,
  ConnectionHelper,
  CountUsers,
  LegacyMongoose,
} from '../legacy-cli-contracts.d.cts';
const { addDays, startOfDay } =
  require('date-fns') as typeof import('date-fns');
const mongooseService = require('./../../config/lib/mongoose.mts')
  .default as ConnectionHelper;
const mongoose = require('mongoose') as LegacyMongoose;
const statsService =
  require('./../../modules/stats/server/services/stats.server.service.mts')
    .default as typeof import('../../modules/stats/server/services/stats.server.service.mts').default;

require('./../../modules/users/server/models/user.server.model.mts');
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

  let currDate = addDays(startOfDay(startDate), 1);
  const lastDate = addDays(startOfDay(endDate), 1);

  while ((currDate = addDays(currDate, 1)) < lastDate) {
    dates.push(currDate);
  }

  return dates;
};

async function fillMembers(): Promise<void> {
  console.log('Connecting to Mongodb...');
  await new Promise<void>(resolve => mongooseService.connect(() => resolve()));
  console.log('Connected to Mongodb.');
  const usersCount = await User.countDocuments(whereQuery);
  console.log('Found ' + usersCount + ' users currently in the DB.\n');
  const cursor = await User.aggregate<AggregatedDayGroup>([
    aggregateMatch,
    aggregateGrouping,
    aggregateSort,
  ]);
  console.log('Filling missing days from aggregated array.\n');
  const dates: DayGroup[] = [];
  let prevDayOfYear: number | false = false;
  let prevDay: number | false = false;
  let prevMonth: number | false = false;
  let prevYear: number | false = false;

  for (const group of cursor) {
    if (
      prevDayOfYear !== false &&
      (prevYear !== group._id.year || prevDayOfYear + 1 !== group._id.dayOfYear)
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
      const prevDayDiffArr = enumerateDaysBetweenDates(startDate, endDate);

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
    prevDayOfYear = group._id.dayOfYear;
    prevDay = group._id.day;
    prevMonth = group._id.month;
    prevYear = group._id.year;

    dates.push(group);
  }
  const daysCount = dates.length;
  console.log('Processing and adding daily counters to Influx...\n');
  const PROGRESS_INTERVAL = 0.1; // percent
  let progress = 0; // progress counter

  for (const countGroup of dates) {
    // showing a progress
    if (progress % Math.ceil((daysCount / 100) * PROGRESS_INTERVAL) === 0) {
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
    await new Promise<void>((resolve, reject) =>
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
          if (err) reject(err);
          else resolve();
        },
      ),
    );
  }
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(
    Math.floor((progress / daysCount) * 100) +
      '% (' +
      progress +
      '/' +
      daysCount +
      ' days)\n- Cumulative user count: ' +
      cumulativeUserCount +
      '\n- Counter to check against: ' +
      usersCount +
      '\n\nDone!\n',
  );
  console.log('\nDisconnecting from Mongodb...');
  await new Promise<void>((resolve, reject) =>
    mongooseService.disconnect(err => {
      if (err) reject(err);
      else resolve();
    }),
  );
}
fillMembers().catch(err => {
  console.error('\nError:');
  console.error(err);
  process.exitCode = 1;
  mongooseService.disconnect(disconnectError => {
    if (disconnectError) console.error(disconnectError);
  });
});
