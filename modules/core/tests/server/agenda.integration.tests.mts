import { Agenda, Job as AgendaJob } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import express from 'express';
import supertest from 'supertest';
import { createExpressMiddleware } from 'agendash';
import sinon from 'sinon';
import {
  MongoClient,
  type Collection,
  type MongoClient as MongoClientInstance,
} from 'mongodb';
import config from './../../../../config/config.mts';
import worker from './../../../../config/lib/worker.mts';
import { shutdownDashboard } from './../../../../config/lib/dashboard.mts';
import 'should';
import assert from 'node:assert/strict';
import { deploymentNotificationJob } from '../../../../config/lib/deployment-notifications.mts';
import { agendaLockLifetime } from '../../../../config/lib/agenda-lock.mts';
import {
  MailDeliveryError,
  mailFailure,
  mailRetriesExhausted,
} from '../../../../config/lib/mail-delivery-error.mts';
import {
  inspectMailQueue,
  recoverEmailJobName,
  recoverInterruptedEmailJobs,
  sendEmailJobName,
} from '../../../../config/lib/mail-queue.mts';

interface StoredJob {
  name: string;
  type?: 'single';
  data?: Record<string, unknown>;
  priority?: number;
  failCount?: number;
  failReason?: string;
  repeatInterval?: string;
  repeatTimezone?: string | null;
  lastModifiedBy?: string;
  nextRunAt?: Date | null;
  lastRunAt?: Date;
  lastFinishedAt?: Date | null;
  lockedAt?: Date | null;
  disabled?: boolean;
}

function persistedDate(value: Date | null | undefined): Date {
  if (!(value instanceof Date))
    throw new Error('Expected a persisted job date');
  return value;
}

describe('Agenda integration tests', function () {
  const collection = 'agendaIntegrationJobs';
  const immediateJobName = 'agenda integration immediate job';
  const recurringJobName = 'agenda integration recurring job';
  const preserveJobName = 'agenda integration preserve nextRunAt';
  const productionShapedJobName = 'agenda integration production shaped job';
  const restartedJobName = 'agenda integration restarted worker job';
  const retryJobName = 'agenda integration network retry job';
  const jobNames = [
    immediateJobName,
    recurringJobName,
    preserveJobName,
    productionShapedJobName,
    restartedJobName,
    retryJobName,
    sendEmailJobName,
    recoverEmailJobName,
  ];
  // Agenda schedules the first human-interval run as "now"; by the time the
  // document is persisted that timestamp can already be slightly in the past.
  const acceptablePastSkewMs = 10 * 1000;
  let agenda: import('agenda').Agenda;
  let agendaBackend: InstanceType<typeof MongoBackend>;
  let mongoClient: MongoClientInstance;
  let jobsCollection: Collection<StoredJob>;

  function findJobs(name: string): Promise<StoredJob[]> {
    return jobsCollection.find({ name }).toArray();
  }

  before(async function () {
    mongoClient = await MongoClient.connect(config.db.uri);
    jobsCollection = mongoClient.db().collection<StoredJob>(collection);
    agendaBackend = new MongoBackend({
      address: config.db.uri,
      collection,
    });
    agenda = new Agenda({
      backend: agendaBackend,
      processEvery: 50,
    });
    // Use the public `ready` event rather than Agenda's private `_ready`
    // promise. Attach immediately after construction so we do not miss the
    // event (connect is asynchronous).
    await new Promise<void>(function (resolve) {
      agenda.once('ready', () => resolve());
    });
  });

  after(async function () {
    if (agenda) {
      await agenda.cancel({
        names: jobNames,
      });
      await agenda.stop();
      await agendaBackend!.disconnect();
    }
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  afterEach(async function () {
    if (jobsCollection) {
      await jobsCollection.deleteMany({ name: { $in: jobNames } });
    }
  });

  it('persists one recurring job when scheduling is repeated', async function () {
    const beforeSchedule = Date.now();
    agenda.define(recurringJobName, function () {});

    await agenda.every('5 minutes', recurringJobName);
    await agenda.every('5 minutes', recurringJobName);

    const jobs = await findJobs(recurringJobName);

    jobs.length.should.equal(1);
    jobs[0].type!.should.equal('single');
    (jobs[0].repeatInterval ?? '').should.equal('5 minutes');
    persistedDate(jobs[0].nextRunAt).should.be.instanceof(Date);
    // Regression for #2420: must not land hours/days in the past.
    persistedDate(jobs[0].nextRunAt)
      .getTime()
      .should.be.above(beforeSchedule - acceptablePastSkewMs);
    persistedDate(jobs[0].nextRunAt)
      .getTime()
      .should.be.below(Date.now() + 1000);
  });

  it('preserves a future nextRunAt when every() is repeated', async function () {
    agenda.define(preserveJobName, function () {});

    const futureNextRunAt = new Date(Date.now() + 60 * 60 * 1000);
    await jobsCollection.insertOne({
      name: preserveJobName,
      type: 'single',
      data: {},
      priority: 0,
      repeatInterval: '5 minutes',
      nextRunAt: futureNextRunAt,
      lastRunAt: new Date(Date.now() - 5 * 60 * 1000),
      lockedAt: null,
      disabled: false,
    });

    await agenda.every('5 minutes', preserveJobName);

    const jobs = await findJobs(preserveJobName);

    jobs.length.should.equal(1);
    persistedDate(jobs[0].nextRunAt).should.be.instanceof(Date);
    // Worker restarts call every() again; Agenda must not rewrite a healthy
    // future schedule into the past (#2415 / #2420).
    persistedDate(jobs[0].nextRunAt).getTime().should.be.above(Date.now());
    Math.abs(
      persistedDate(jobs[0].nextRunAt).getTime() - futureNextRunAt.getTime(),
    ).should.be.below(1000);
  });

  it('preserves production-shaped recurring job schedules across every()', async function () {
    agenda.define(productionShapedJobName, function () {});

    const lastFinishedAt = new Date(Date.now() - 5 * 60 * 1000);
    const lastRunAt = new Date(Date.now() - 4 * 60 * 1000);
    const lockedAt = new Date(Date.now() - 3 * 60 * 1000);
    const nextRunAt = new Date(Date.now() + 60 * 1000);

    // Shape mirrors Trustroots agendaJobs documents for repeating worker jobs
    // after they have already run successfully at least once.
    await jobsCollection.insertOne({
      name: productionShapedJobName,
      type: 'single',
      data: {},
      priority: 0,
      repeatInterval: '5 minutes',
      repeatTimezone: null,
      lastModifiedBy: 'trustroots-worker',
      nextRunAt,
      lastRunAt,
      lastFinishedAt,
      lockedAt,
      disabled: false,
    });

    await agenda.every('5 minutes', productionShapedJobName);
    await agenda.every('5 minutes', productionShapedJobName);

    const jobs = await findJobs(productionShapedJobName);

    jobs.length.should.equal(1);
    (jobs[0].repeatInterval ?? '').should.equal('5 minutes');
    persistedDate(jobs[0].nextRunAt).getTime().should.be.above(Date.now());
    Math.abs(
      persistedDate(jobs[0].nextRunAt).getTime() - nextRunAt.getTime(),
    ).should.be.below(1000);
    persistedDate(jobs[0].lastRunAt)
      .getTime()
      .should.equal(lastRunAt.getTime());
    persistedDate(jobs[0].lastFinishedAt)
      .getTime()
      .should.equal(lastFinishedAt.getTime());
    const {
      jobs: [persisted],
    } = await agenda.queryJobs({ name: productionShapedJobName });
    await new AgendaJob(agenda, persisted).save();
    const [savedAgain] = await findJobs(productionShapedJobName);
    persistedDate(savedAgain.lastRunAt)
      .getTime()
      .should.equal(lastRunAt.getTime());
    persistedDate(savedAgain.lastFinishedAt)
      .getTime()
      .should.equal(lastFinishedAt.getTime());
    persistedDate(savedAgain.lockedAt)
      .getTime()
      .should.equal(lockedAt.getTime());
  });

  it('preserves a recurring schedule when a new Agenda instance registers it', async function () {
    agenda.define(restartedJobName, function () {});
    await agenda.every('5 minutes', restartedJobName);

    const nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
    await jobsCollection.updateOne(
      { name: restartedJobName },
      { $set: { nextRunAt } },
    );

    const restartedBackend = new MongoBackend({
      address: config.db.uri,
      collection,
    });
    const restartedAgenda = new Agenda({ backend: restartedBackend });
    try {
      await new Promise<void>(function (resolve) {
        restartedAgenda.once('ready', () => resolve());
      });
      restartedAgenda.define(restartedJobName, function () {});
      await restartedAgenda.every('5 minutes', restartedJobName);

      const jobs = await jobsCollection
        .find({ name: restartedJobName })
        .toArray();
      jobs.length.should.equal(1);
      persistedDate(jobs[0].nextRunAt)
        .getTime()
        .should.equal(nextRunAt.getTime());
    } finally {
      await restartedAgenda.stop();
      await restartedBackend.disconnect();
    }
  });

  it('persists retry timing with Agenda processor state after a network failure', async function () {
    const retryDelaySeconds = 60;
    const retryOptions = { maxAttempts: 3, retryDelaySeconds };
    const failure = new Error('ECONNRESET');
    const completed = new Promise<void>(resolve => {
      agenda.once(`complete:${retryJobName}`, resolve);
    });
    agenda.once(`fail:${retryJobName}`, (err, job) => {
      worker.scheduleRetry(err, job, retryOptions);
    });
    agenda.define(retryJobName, function (_job, done) {
      done(failure);
    });

    await agenda.start();
    await agenda.now(retryJobName, { marker: 'anonymous' });
    await completed;

    const persisted = await jobsCollection.findOne({ name: retryJobName });
    if (!persisted) throw new Error('Expected the failed retry job to persist');
    persisted.failCount!.should.equal(1);
    persistedDate(persisted.nextRunAt)
      .getTime()
      .should.be.above(Date.now() + retryDelaySeconds * 1000 - 1000);
  });

  it('persists temporary SMTP retries and exposes exhausted delivery attempts', async function () {
    const retryOptions = { maxAttempts: 2, retryDelaySeconds: 2 };
    const failure = new MailDeliveryError({
      command: 'RCPT TO',
      responseCode: 450,
    });
    const scheduled: Date[] = [];
    agenda.on(`fail:${sendEmailJobName}`, schedule);
    function schedule(error: Error, job: AgendaJob) {
      const next = worker.scheduleRetry(error, job, retryOptions);
      if (next) scheduled.push(next);
    }

    agenda.define(sendEmailJobName, async () => {
      throw failure;
    });
    const first = new Promise<void>(resolve =>
      agenda.once(`complete:${sendEmailJobName}`, resolve),
    );
    try {
      await agenda.start();
      await agenda.now(sendEmailJobName, undefined);
      await first;
      const persisted = await jobsCollection.findOne({
        name: sendEmailJobName,
      });
      assert.equal(persisted?.failCount, 1);
      assert.deepEqual(persisted?.nextRunAt, scheduled[0]);
      assert.equal(
        (await inspectMailQueue(mongoClient.db().collection(collection)))
          .retrying,
        1,
      );

      const next = new Promise<void>(resolve =>
        agenda.once(`complete:${sendEmailJobName}`, resolve),
      );
      await next;
      const exhausted = await jobsCollection.findOne({
        name: sendEmailJobName,
      });
      assert.equal(exhausted?.failCount, 2);
      assert.equal(exhausted.nextRunAt, null);
      assert.equal(
        exhausted.failReason,
        mailRetriesExhausted + ': ' + mailFailure.temporary,
      );
      assert.equal(
        (await inspectMailQueue(mongoClient.db().collection(collection)))
          .exhausted,
        1,
      );
    } finally {
      agenda.off(`fail:${sendEmailJobName}`, schedule);
    }
  });

  it('recovers interrupted sends after restart and keeps scheduled and finished sends intact', async function () {
    const mailJobs = mongoClient.db().collection('agendaRestartRecoveryJobs');
    const now = new Date();
    const stale = new Date(now.getTime() - agendaLockLifetime - 1000);
    const earlier = new Date(stale.getTime() - 1000);
    const future = new Date(now.getTime() + 3600_000);
    const job = { name: sendEmailJobName, nextRunAt: null, lastRunAt: stale };
    const { insertedIds } = await mailJobs.insertMany([
      { ...job, lockedAt: stale },
      {
        ...job,
        name: deploymentNotificationJob,
        lockedAt: null,
        lastFinishedAt: earlier,
        failCount: 2,
      },
      { ...job, nextRunAt: future, lastFinishedAt: earlier },
      { ...job, lastFinishedAt: stale, failCount: 1 },
      { ...job, lockedAt: now, lastRunAt: now },
      { ...job, lockedAt: stale, disabled: true },
      { name: recoverEmailJobName, type: 'single', lastFinishedAt: now },
    ]);

    try {
      assert.equal((await inspectMailQueue(mailJobs, now)).stalledAttempts, 2);
      const result = await recoverInterruptedEmailJobs(mailJobs, now);
      assert.equal(result.modifiedCount, 2);
      const jobs = await Promise.all(
        Object.values(insertedIds).map(_id => mailJobs.findOne({ _id })),
      );
      assert.deepEqual(
        jobs.map(job => job?.nextRunAt),
        [now, now, future, null, null, null, undefined],
      );
      assert.equal(jobs[1]?.failCount, 2);
      assert.equal(
        (await recoverInterruptedEmailJobs(mailJobs, now)).modifiedCount,
        0,
      );
      const status = await inspectMailQueue(mailJobs, now);
      assert.equal(status.workerHealthy, true);
      assert.equal(status.stalledAttempts, 0);
    } finally {
      await mailJobs.deleteMany({});
    }
  });

  it('serves the Agenda 6 dashboard middleware from the shared jobs collection', async function () {
    const app = express();
    app.use('/', createExpressMiddleware(agenda));

    const response = await supertest(app).get('/api').expect(200);
    Array.isArray(response.body.jobs).should.equal(true);
  });

  it('disconnects the standalone dashboard MongoDB connection when not started', async function () {
    const backend = new MongoBackend({
      address: config.db.uri,
      collection: 'agendaDashboardShutdownTestJobs',
    });
    const dashboardAgenda = new Agenda({ backend });
    await dashboardAgenda.ready;
    const disconnect = sinon.spy(backend, 'disconnect');

    await shutdownDashboard(dashboardAgenda, backend);

    disconnect.calledOnce.should.equal(true);
  });

  it('persists and executes an immediate job', async function () {
    const payload = { marker: 'anonymous-scheduling-test' };
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const completed = new Promise<void>(function (resolve, reject) {
      timeout = setTimeout(function () {
        reject(new Error('Agenda did not execute the immediate test job'));
      }, 5000);

      agenda.once(`complete:${immediateJobName}`, () => resolve());
      agenda.once(`fail:${immediateJobName}`, reject);
    });

    agenda.define(immediateJobName, function (job: import('agenda').Job) {
      if (!job.attrs.data)
        throw new Error('Expected the scheduled job payload');
      job.attrs.data.should.deepEqual(payload);
    });

    await agenda.start();
    await agenda.now(immediateJobName, payload);
    await completed;
    clearTimeout(timeout);

    const jobs = await jobsCollection
      .find({ name: immediateJobName })
      .toArray();

    jobs.length.should.equal(1);
    persistedDate(jobs[0].lastFinishedAt).should.be.instanceof(Date);
  });

  it('unlocks only unfinished jobs after a worker restart', async function () {
    const jobs = mongoClient.db().collection<StoredJob>('agendaJobs');
    const marker = 'anonymous-unlock-integration-test';
    const lockedAt = new Date(Date.now() - 11 * 60 * 1000);
    const activeLockedAt = new Date(Date.now() - 60 * 1000);
    const futureRun = new Date(Date.now() + 60 * 60 * 1000);
    const activeFutureRun = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await jobs.insertMany([
      {
        name: `${marker}-unfinished`,
        lockedAt,
        lastModifiedBy: 'stopped-worker',
        lastRunAt: lockedAt,
        nextRunAt: null,
        lastFinishedAt: null,
      },
      {
        name: `${marker}-finished`,
        lockedAt,
        lastFinishedAt: new Date(),
        nextRunAt: futureRun,
      },
      {
        name: `${marker}-scheduled`,
        nextRunAt: futureRun,
        lockedAt: null,
        lastFinishedAt: null,
      },
      {
        name: `${marker}-active-first-run`,
        lockedAt: activeLockedAt,
        lastModifiedBy: 'another-worker',
        lastRunAt: activeLockedAt,
        lastFinishedAt: null,
        nextRunAt: activeFutureRun,
      },
    ]);

    try {
      await new Promise<void>(function (resolve, reject) {
        worker.unlockAgendaJobs(function (err) {
          if (err) reject(err);
          else resolve();
        });
      });

      const [unfinished, finished, scheduled, activeFirstRun] =
        await Promise.all([
          jobs.findOne({ name: `${marker}-unfinished` }),
          jobs.findOne({ name: `${marker}-finished` }),
          jobs.findOne({ name: `${marker}-scheduled` }),
          jobs.findOne({ name: `${marker}-active-first-run` }),
        ]);

      if (!unfinished || !finished || !scheduled || !activeFirstRun) {
        throw new Error('Expected all persisted scheduling fixtures');
      }
      unfinished.should.not.have.property('lockedAt');
      unfinished.should.not.have.property('lastModifiedBy');
      unfinished.should.not.have.property('lastRunAt');
      persistedDate(persistedDate(unfinished.nextRunAt)).should.be.instanceof(
        Date,
      );
      persistedDate(persistedDate(unfinished.nextRunAt))
        .getTime()
        .should.be.above(lockedAt.getTime());

      persistedDate(finished.lockedAt)
        .getTime()
        .should.equal(lockedAt.getTime());
      persistedDate(finished.nextRunAt)
        .getTime()
        .should.equal(futureRun.getTime());
      scheduled.should.have.property('lockedAt', null);
      persistedDate(scheduled.nextRunAt)
        .getTime()
        .should.equal(futureRun.getTime());
      persistedDate(activeFirstRun.lockedAt)
        .getTime()
        .should.equal(activeLockedAt.getTime());
      activeFirstRun.should.have.property('lastModifiedBy', 'another-worker');
      persistedDate(activeFirstRun.lastRunAt)
        .getTime()
        .should.equal(activeLockedAt.getTime());
      activeFirstRun.should.have.property('lastFinishedAt', null);
      persistedDate(activeFirstRun.nextRunAt)
        .getTime()
        .should.equal(activeFutureRun.getTime());
    } finally {
      await jobs.deleteMany({ name: { $regex: `^${marker}-` } });
    }
  });
});
