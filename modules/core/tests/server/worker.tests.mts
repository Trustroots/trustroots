import type { Agenda } from 'agenda';
import { MongoClient } from 'mongodb';
import sinon from 'sinon';
import 'should';
import agendaModule from './../../../../config/lib/agenda.mts';
import workerModule from './../../../../config/lib/worker.mts';
import experiences from '../../../experiences/server/worker-entry.mts';
import mockModule from './../../../../testutils/server/mock-module.mts';

describe('Worker tests', function () {
  interface AgendaDouble {
    start(): Promise<void>;
    stop(): Promise<void>;
    drain(timeout: number): Promise<{ timedOut: boolean; running?: number }>;
    on(name: string, fn: (...args: never[]) => void): unknown;
    define(name: string, fn: unknown, options: object): unknown;
    every(repeat: string, name: string): Promise<void>;
  }
  interface WorkerDouble {
    start(
      options: typeof workerOptions,
      callback?: (error?: Error) => void,
    ): Promise<void>;
    unlockAgendaJobs(callback: (error?: Error) => void): void;
    removeExitListeners(): void;
    gracefulExit(): Promise<void>;
  }
  const agenda = agendaModule as unknown as AgendaDouble;
  const worker = workerModule as unknown as WorkerDouble;

  interface WorkerJob {
    attrs: {
      _id: string;
      name: string;
      failCount: number;
      nextRunAt?: Date;
    };
    schedule(time: Date): WorkerJob;
  }
  type JobFailureHandler = (error: Error, job: WorkerJob) => void;
  interface DefinedJob {
    name: string;
    options: object;
    fn: unknown;
  }
  interface ScheduledJob {
    repeat: string;
    name: string;
  }

  const workerOptions = {
    maxAttempts: 3,
    retryDelaySeconds: 3,
  };

  let failHandler: JobFailureHandler;
  let startStub: import('sinon').SinonStub;
  let stopStub: import('sinon').SinonStub;
  let drainStub: import('sinon').SinonStub;
  let everyStub: import('sinon').SinonStub;
  const definedJobs: DefinedJob[] = [];
  const scheduledJobs: ScheduledJob[] = [];

  beforeEach(function () {
    // Reset

    definedJobs.length = 0;
    scheduledJobs.length = 0;

    // Stub out all of agendas functionality as we are not testing agenda

    startStub = sinon.stub(agenda, 'start').resolves();
    stopStub = sinon.stub(agenda, 'stop').resolves();
    drainStub = sinon.stub(agenda, 'drain').resolves({ timedOut: false });

    // Save handler for agenda.on('fail')

    sinon.stub(agenda, 'on').callsFake(function (name, fn) {
      if (name === 'fail') {
        failHandler = fn as JobFailureHandler;
      }
    });

    // Collect calls to agenda.define() and agenda.every()

    sinon.stub(agenda, 'define').callsFake(function (name, fn, options) {
      definedJobs.push({ name, options, fn });
    });

    everyStub = sinon.stub(agenda, 'every').callsFake(function (repeat, name) {
      scheduledJobs.push({ repeat, name });
      return Promise.resolve();
    });
    // Allow for easily maths for nextRunAt calculations

    sinon.useFakeTimers();
  });

  afterEach(function () {
    sinon.restore();
    worker.removeExitListeners();
  });

  beforeEach(function (done) {
    worker.start(workerOptions, done);
  });

  it('registers and schedules Experience reply reminders', function () {
    const jobNames = definedJobs.map(job => job.name);
    jobNames.should.containEql('queue experience reply reminders');
    jobNames.should.containEql('send experience reply reminder');
    scheduledJobs.should.containEql({
      name: 'queue experience reply reminders',
      repeat: '30 minutes',
    });
  });

  it('will not retry with a non-network error', function () {
    const job: WorkerJob = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: 0,
      },
      schedule(time) {
        this.attrs.nextRunAt = time;
        return this;
      },
    };
    const err = new Error('some regular error');
    const schedule = sinon.spy(job, 'schedule');
    failHandler(err, job);
    schedule.notCalled.should.equal(true);
  });

  it('registers Agenda delivery retention every 15 minutes', function () {
    const name = 'prune agenda delivery jobs';
    definedJobs.map(job => job.name).should.containEql(name);
    scheduledJobs.should.containEql({
      name,
      repeat: '*/15 * * * *',
    });
  });

  it('schedules unread-message digests', function () {
    scheduledJobs.should.containEql({
      name: 'queue unread message digests',
      repeat: '5 minutes',
    });
  });

  for (const name of [
    'send email',
    'check unread messages',
    'daily statistics',
    'send signup reminders',
    'reactivate hosts',
    'welcome sequence first',
    'welcome sequence second',
    'welcome sequence third',
    'publish expired experiences',
  ])
    it(`defines [${name}] job`, function () {
      definedJobs.map(job => job.name).should.containEql(name);
    });

  it('defines right number of repeating jobs', function () {
    scheduledJobs.length.should.equal(13);
    scheduledJobs.should.containEql({
      name: 'capture agenda storage',
      repeat: '0 3 * * *',
    });
  });

  it('starts Agenda before scheduling recurring jobs', function () {
    startStub.calledBefore(everyStub).should.equal(true);
  });

  it('drains running jobs before stopping on a worker signal', async function () {
    const exit = sinon.stub(process, 'exit').returns(undefined as never);
    await worker.gracefulExit();

    drainStub.calledOnceWithExactly(30_000).should.equal(true);
    stopStub.calledOnce.should.equal(true);
    exit.calledOnceWithExactly(0).should.equal(true);
  });

  it('exits unsuccessfully when graceful worker shutdown times out', async function () {
    drainStub.resolves({ timedOut: true, running: 1 });
    const error = sinon.stub(console, 'error');
    const exit = sinon.stub(process, 'exit').returns(undefined as never);
    await worker.gracefulExit();

    drainStub.calledOnceWithExactly(30_000).should.equal(true);
    stopStub.calledOnce.should.equal(true);
    error
      .calledWith('[Worker] Agenda drain timed out with %d running job(s).', 1)
      .should.equal(true);
    exit.calledOnceWithExactly(1).should.equal(true);
  });

  it('reports recurring scheduling failures during worker startup', async function () {
    const scheduleError = new Error('Recurring job could not be scheduled');
    everyStub.rejects(scheduleError);

    try {
      await new Promise<void>(function (resolve, reject) {
        worker
          .start(workerOptions, function (err?: Error) {
            if (err !== scheduleError) {
              reject(err || new Error('Expected the scheduling failure'));
            } else {
              resolve();
            }
          })
          .catch(function () {});
      });
      startStub.calledTwice.should.equal(true);
    } finally {
      worker.removeExitListeners();
    }
  });

  it('keeps worker registrations in their original order', function () {
    definedJobs
      .map(job => job.name)
      .should.deepEqual([
        'prune agenda delivery jobs',
        'capture agenda storage',
        'send email',
        'send deployment notification email',
        'deliver signup reminder',
        'recover interrupted email delivery',
        'send Android message notification',
        'send Android test notification',
        'queue unread message digests',
        'check unread messages',
        'daily statistics',
        'send signup reminders',
        'reactivate hosts',
        'welcome sequence first',
        'welcome sequence second',
        'welcome sequence third',
        'publish expired experiences',
        'queue experience reply reminders',
        'send experience reply reminder',
        'send support message',
        'poll support mailbox',
        'recover support messages',
      ]);
  });

  it('removes completed signup reminder deliveries', function () {
    definedJobs
      .find(job => job.name === 'deliver signup reminder')!
      .options.should.deepEqual({
        priority: 'high',
        concurrency: 10,
        removeOnComplete: true,
      });
  });

  it('only schedules defined jobs', function () {
    const jobNames = definedJobs.map(job => job.name);
    scheduledJobs.forEach(function (job) {
      job.name.should.be.oneOf(jobNames);
    });
  });

  it('refuses to start when a job module has no handler', async function () {
    const { registerWorkerJobs } = await mockModule<
      typeof import('../../../../layers/server/worker-jobs.mts')
    >(new URL('../../../../layers/server/worker-jobs.mts', import.meta.url), {
      '../../modules/experiences/server/worker-entry.mts': {
        ...experiences,
        publishExperiences: async () => ({}),
      },
    });
    await registerWorkerJobs(
      agenda as unknown as Agenda,
    ).should.be.rejectedWith(
      'Agenda job "publish expired experiences" has no handler',
    );
  });

  it('unlocks unfinished Agenda jobs through the direct MongoDB connection', function (done) {
    const updateMany = sinon.stub().callsFake(function (
      filter: { lockedAt: { $lte: Date }; lastFinishedAt: null },
      update: { $unset: Record<string, string>; $set: { nextRunAt: Date } },
    ) {
      filter.lockedAt.$lte.should.be.instanceof(Date);
      Math.abs(
        filter.lockedAt.$lte.getTime() - (Date.now() - 10 * 60 * 1000),
      ).should.be.below(1000);
      filter.should.have.property('lastFinishedAt', null);
      update.$unset.should.deepEqual({
        lockedAt: '',
        lastModifiedBy: '',
        lastRunAt: '',
      });
      update.$set.nextRunAt.should.be.instanceof(Date);
      return Promise.resolve({ modifiedCount: 2 });
    });
    const close = sinon.stub().resolves();

    sinon.stub(MongoClient, 'connect').resolves({
      close,
      db() {
        return {
          collection(name: string) {
            name.should.equal('agendaJobs');
            return { updateMany };
          },
        };
      },
    } as never);

    worker.unlockAgendaJobs(function (err?: Error) {
      if (err) return done(err);
      updateMany.calledOnce.should.equal(true);
      close.calledOnce.should.equal(true);
      done();
    });
  });

  it('reports MongoDB connection failures while unlocking jobs', function (done) {
    const connectionError = new Error('connection failed');
    sinon.stub(console, 'error');
    sinon.stub(MongoClient, 'connect').rejects(connectionError);

    worker.unlockAgendaJobs(function (err?: Error) {
      if (!err) return done(new Error('Expected the connection error'));
      err.should.equal(connectionError);
      done();
    });
  });

  it('closes MongoDB and reports update failures while unlocking jobs', function (done) {
    const updateError = new Error('update failed');
    const close = sinon.stub().resolves();
    sinon.stub(console, 'error');
    sinon.stub(MongoClient, 'connect').resolves({
      close,
      db() {
        return {
          collection() {
            return {
              updateMany() {
                return Promise.reject(updateError);
              },
            };
          },
        };
      },
    } as never);

    worker.unlockAgendaJobs(function (err?: Error) {
      if (!err) return done(new Error('Expected the update error'));
      err.should.equal(updateError);
      close.calledOnce.should.equal(true);
      done();
    });
  });
});
