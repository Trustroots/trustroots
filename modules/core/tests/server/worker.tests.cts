const _: typeof import('lodash') = require('lodash');
const MongoClient: typeof import('mongodb').MongoClient =
  require('mongodb').MongoClient;
const sinon: typeof import('sinon') = require('sinon');
require('should');

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
  const agenda: AgendaDouble = require('../../../../config/lib/agenda.mjs');
  const worker: WorkerDouble = require('../../../../config/lib/worker.mjs');

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

  it('will retry on ECONNREFUSED', function () {
    const job: WorkerJob = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts - 1,
      },
      schedule(time) {
        this.attrs.nextRunAt = time;
        return this;
      },
    };
    const err = new Error('ECONNREFUSED');
    const schedule = sinon.spy(job, 'schedule');
    failHandler(err, job);
    schedule.calledOnce.should.equal(true);
    job.attrs.nextRunAt!.should.be.instanceof(Date);
    job.attrs
      .nextRunAt!.getTime()
      .should.equal(workerOptions.retryDelaySeconds * 1000);
  });

  it('will retry on ECONNRESET', function () {
    const job: WorkerJob = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts - 1,
      },
      schedule(time) {
        this.attrs.nextRunAt = time;
        return this;
      },
    };
    const err = new Error('ECONNRESET');
    const schedule = sinon.spy(job, 'schedule');
    failHandler(err, job);
    schedule.calledOnce.should.equal(true);
    job.attrs.nextRunAt!.should.be.instanceof(Date);
    job.attrs
      .nextRunAt!.getTime()
      .should.equal(workerOptions.retryDelaySeconds * 1000);
  });

  it('will not retry when max retries is reached', function () {
    const job: WorkerJob = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts,
      },
      schedule(time) {
        this.attrs.nextRunAt = time;
        return this;
      },
    };
    const err = new Error('ECONNRESET');
    const schedule = sinon.spy(job, 'schedule');
    failHandler(err, job);
    schedule.notCalled.should.equal(true);
  });

  it('defines [send email] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send email');
  });

  it('defines [check unread messages] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('check unread messages');
  });

  it('defines [daily statistics] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('daily statistics');
  });

  it('defines [send signup reminders] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send signup reminders');
  });

  it('defines [reactivate hosts] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('reactivate hosts');
  });

  it('defines [welcome sequence first] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('welcome sequence first');
  });

  it('defines [welcome sequence second] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('welcome sequence second');
  });

  it('defines [welcome sequence third] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('welcome sequence third');
  });

  it('defines [publish expired experiences] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('publish expired experiences');
  });

  it('defines right number of repeating jobs', function () {
    scheduledJobs.length.should.equal(8);
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

  it('only schedules defined jobs', function () {
    const jobNames = _.map(definedJobs, 'name');
    scheduledJobs.forEach(function (job) {
      job.name.should.be.oneOf(jobNames);
    });
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
