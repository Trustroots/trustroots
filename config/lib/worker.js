const format = require('util').format;
const path = require('path');

const config = require('../config');
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const sendEmailJob = require(path.resolve(
  './modules/core/server/jobs/send-email.server.job',
));
const sendPushMessageJob = require(path.resolve(
  './modules/core/server/jobs/send-push-message.server.job',
));
const messageUnreadJob = require(path.resolve(
  './modules/messages/server/jobs/message-unread.server.job',
));
const dailyStatisticsJob = require(path.resolve(
  './modules/statistics/server/jobs/daily-statistics.server.job',
));
const userFinishSignupJob = require(path.resolve(
  './modules/users/server/jobs/user-finish-signup.server.job',
));
const reactivateHostsJob = require(path.resolve(
  './modules/offers/server/jobs/reactivate-hosts.server.job',
));
const userWelcomeSequenceFirstJob = require(path.resolve(
  './modules/users/server/jobs/user-welcome-sequence-first.server.job',
));
const userWelcomeSequenceSecondJob = require(path.resolve(
  './modules/users/server/jobs/user-welcome-sequence-second.server.job',
));
const userWelcomeSequenceThirdJob = require(path.resolve(
  './modules/users/server/jobs/user-welcome-sequence-third.server.job',
));
const experiencesPublishJob = require(path.resolve(
  './modules/experiences/server/jobs/experiences-publish.server.job',
));

const MongoClient = require('mongodb').MongoClient;

let agenda;

exports.start = (options, callback) => {
  // Don't initialise Agenda outisde `start()`, because we might miss `ready` event otherwise.
  agenda = require(path.resolve('./config/lib/agenda'));

  agenda.on('ready', async () => {
    // Define jobs

    agenda.define(
      'send email',
      { priority: 'high', concurrency: 10 },
      sendEmailJob,
    );

    agenda.define(
      'send push message',
      { priority: 'high', concurrency: 10 },
      sendPushMessageJob,
    );

    agenda.define(
      'check unread messages',
      { lockLifetime: 10000 },
      messageUnreadJob,
    );

    agenda.define(
      'daily statistics',
      { lockLifetime: 10000, concurrency: 1 },
      dailyStatisticsJob,
    );

    agenda.define(
      'send signup reminders',
      { lockLifetime: 10000, concurrency: 1 },
      userFinishSignupJob,
    );

    agenda.define(
      'reactivate hosts',
      { lockLifetime: 10000, concurrency: 1 },
      reactivateHostsJob,
    );

    agenda.define(
      'welcome sequence first',
      { lockLifetime: 10000, concurrency: 1 },
      userWelcomeSequenceFirstJob,
    );

    agenda.define(
      'welcome sequence second',
      { lockLifetime: 10000, concurrency: 1 },
      userWelcomeSequenceSecondJob,
    );

    agenda.define(
      'welcome sequence third',
      { lockLifetime: 10000, concurrency: 1 },
      userWelcomeSequenceThirdJob,
    );

    agenda.define(
      'publish expired experiences',
      { lockLifetime: 10000, concurrency: 1 },
      experiencesPublishJob,
    );

    // Schedule job(s)

    await agenda.every('5 minutes', 'check unread messages');
    await agenda.every('24 hours', 'daily statistics');
    await agenda.every('30 minutes', 'send signup reminders');
    await agenda.every('30 minutes', 'reactivate hosts');
    await agenda.every('15 minutes', 'welcome sequence first');
    await agenda.every('60 minutes', 'welcome sequence second');
    await agenda.every('60 minutes', 'welcome sequence third');
    await agenda.every('23 minutes', 'publish expired experiences');

    // Start worker

    await agenda.start();

    if (process.env.NODE_ENV !== 'test') {
      console.log('[Worker] Agenda started processing background jobs');
    }

    if (callback) {
      callback();
    }
  });

  // Log finished jobs
  agenda.on('success', job => {
    if (process.env.NODE_ENV !== 'test') {
      const statsObject = {
        namespace: 'agendaJob',
        counts: {
          count: 1,
        },
        tags: {
          name: job.attrs.name,
          status: 'success',
          failCount: job.attrs.failCount || 0,
        },
      };

      // Send job failure to stats servers
      statService.stat(statsObject, () => {
        // Log also to console
        if (process.env.NODE_ENV !== 'test') {
          console.log(
            '[Worker] Agenda job [%s] %s finished.',
            job.attrs.name,
            job.attrs._id,
          );
        }
      });
    }
  });

  // Error reporting and retry logic
  agenda.on('fail', (err, job) => {
    let extraMessage = '';

    if (job.attrs.failCount >= options.maxAttempts) {
      extraMessage = format('too many failures, giving up');
    } else if (shouldRetry(err)) {
      job.attrs.nextRunAt = secondsFromNowDate(options.retryDelaySeconds);

      extraMessage = format(
        'will retry in %s seconds at %s',
        options.retryDelaySeconds,
        job.attrs.nextRunAt.toISOString(),
      );

      job.save();
    }

    const statsObject = {
      namespace: 'agendaJob',
      counts: {
        count: 1,
      },
      tags: {
        name: job.attrs.name,
        status: 'failed',
        failCount: job.attrs.failCount || 0,
      },
    };

    // Send job failure to stats servers
    statService.stat(statsObject, () => {
      // Log also to console

      if (process.env.NODE_ENV !== 'test') {
        console.error(
          '[Worker] Agenda job [%s] %s failed with [%s] %s failCount:%s',
          job.attrs.name,
          job.attrs._id,
          err.message || 'Unknown error',
          extraMessage,
          job.attrs.failCount,
        );
      }
    });
  });

  // Gracefully exit Agenda
  addExitListeners();
};

/**
 * Attempt to unlock Agenda jobs that were stuck due server restart
 * See https://github.com/agenda/agenda/issues/410
 */
exports.unlockAgendaJobs = callback => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[Worker] Attempting to unlock locked Agenda jobs...');
  }

  // Use connect method to connect to the server
  MongoClient.connect(config.db.uri, function (err, client) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    // Re-use Agenda's MongoDB connection
    // var agendaJobs = agenda._mdb.collection('agendaJobs');
    const agendaJobs = client.db().collection('agendaJobs');

    agendaJobs.update(
      {
        lockedAt: {
          $exists: true,
        },
        lastFinishedAt: {
          $exists: false,
        },
      },
      {
        $unset: {
          lockedAt: undefined,
          lastModifiedBy: undefined,
          lastRunAt: undefined,
        },
        $set: {
          nextRunAt: new Date(),
        },
      },
      {
        multi: true,
      },
      (err, numUnlocked) => {
        if (err) {
          console.error(err);
        }
        if (process.env.NODE_ENV !== 'test') {
          console.log(
            '[Worker] Unlocked %d Agenda jobs.',
            parseInt(numUnlocked, 10) || 0,
          );
        }
        client.close(callback);
      },
    );
  });
};

/**
 * Used for testing
 */
exports.removeExitListeners = () => {
  process.removeListener('SIGTERM', gracefulExit);
  process.removeListener('SIGINT', gracefulExit);
};

/**
 * Adds listeners to allow Agenda exit gracefully
 */
function addExitListeners() {
  process.on('SIGTERM', gracefulExit);
  process.on('SIGINT', gracefulExit);
}

/**
 * Gracefully exit Agenda
 */
async function gracefulExit() {
  console.log('[Worker] Stopping Agenda...');
  await agenda.stop();
  console.log('[Worker] Agenda stopped.');
  process.exit(0);
}

function shouldRetry(err) {
  // Retry on connection errors as they may just be temporary
  return /(ECONNRESET|ECONNREFUSED)/.test(err.message);
}

function secondsFromNowDate(seconds) {
  return new Date(new Date().getTime() + seconds * 1000);
}
