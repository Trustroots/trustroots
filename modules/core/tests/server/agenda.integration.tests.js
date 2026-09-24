const Agenda = require('agenda');
const MongoClient = require('mongodb').MongoClient;
const config = require('../../../../config/config');
const worker = require('../../../../config/lib/worker');
require('should');

describe('Agenda integration tests', function () {
  const collection = 'agendaIntegrationJobs';
  const immediateJobName = 'agenda integration immediate job';
  const recurringJobName = 'agenda integration recurring job';
  const preserveJobName = 'agenda integration preserve nextRunAt';
  const productionShapedJobName = 'agenda integration production shaped job';
  const jobNames = [
    immediateJobName,
    recurringJobName,
    preserveJobName,
    productionShapedJobName,
  ];
  // Agenda schedules the first human-interval run as "now"; by the time the
  // document is persisted that timestamp can already be slightly in the past.
  const acceptablePastSkewMs = 10 * 1000;
  let agenda;
  let mongoClient;
  let jobsCollection;

  before(async function () {
    mongoClient = await MongoClient.connect(config.db.uri);
    jobsCollection = mongoClient.db().collection(collection);
    agenda = new Agenda({
      db: {
        address: config.db.uri,
        collection,
      },
      processEvery: 50,
    });
    // Use the public `ready` event rather than Agenda's private `_ready`
    // promise. Attach immediately after construction so we do not miss the
    // event (connect is asynchronous).
    await new Promise(function (resolve) {
      agenda.once('ready', resolve);
    });
  });

  after(async function () {
    if (agenda) {
      await agenda.cancel({
        name: { $in: jobNames },
      });
      await agenda.stop();
      await agenda.close();
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

    const jobs = await agenda.jobs({ name: recurringJobName });

    jobs.length.should.equal(1);
    jobs[0].attrs.type.should.equal('single');
    jobs[0].attrs.repeatInterval.should.equal('5 minutes');
    jobs[0].attrs.nextRunAt.should.be.instanceof(Date);
    // Regression for #2420: must not land hours/days in the past.
    jobs[0].attrs.nextRunAt
      .getTime()
      .should.be.above(beforeSchedule - acceptablePastSkewMs);
    jobs[0].attrs.nextRunAt.getTime().should.be.below(Date.now() + 1000);
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

    const jobs = await agenda.jobs({ name: preserveJobName });

    jobs.length.should.equal(1);
    jobs[0].attrs.nextRunAt.should.be.instanceof(Date);
    // Worker restarts call every() again; Agenda must not rewrite a healthy
    // future schedule into the past (#2415 / #2420).
    jobs[0].attrs.nextRunAt.getTime().should.be.above(Date.now());
    Math.abs(
      jobs[0].attrs.nextRunAt.getTime() - futureNextRunAt.getTime(),
    ).should.be.below(1000);
  });

  it('preserves production-shaped recurring job schedules across every()', async function () {
    agenda.define(productionShapedJobName, function () {});

    const lastFinishedAt = new Date(Date.now() - 4 * 60 * 1000);
    const lastRunAt = new Date(Date.now() - 4 * 60 * 1000);
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
      lockedAt: null,
      disabled: false,
    });

    await agenda.every('5 minutes', productionShapedJobName);
    await agenda.every('5 minutes', productionShapedJobName);

    const jobs = await agenda.jobs({ name: productionShapedJobName });

    jobs.length.should.equal(1);
    jobs[0].attrs.repeatInterval.should.equal('5 minutes');
    jobs[0].attrs.nextRunAt.getTime().should.be.above(Date.now());
    Math.abs(
      jobs[0].attrs.nextRunAt.getTime() - nextRunAt.getTime(),
    ).should.be.below(1000);
    jobs[0].attrs.lastRunAt.getTime().should.equal(lastRunAt.getTime());
    jobs[0].attrs.lastFinishedAt
      .getTime()
      .should.equal(lastFinishedAt.getTime());
  });

  it('persists and executes an immediate job', async function () {
    const payload = { marker: 'anonymous-scheduling-test' };
    let timeout;

    const completed = new Promise(function (resolve, reject) {
      timeout = setTimeout(function () {
        reject(new Error('Agenda did not execute the immediate test job'));
      }, 5000);

      agenda.once(`success:${immediateJobName}`, resolve);
      agenda.once(`fail:${immediateJobName}`, reject);
    });

    agenda.define(immediateJobName, function (job) {
      job.attrs.data.should.deepEqual(payload);
    });

    await agenda.start();
    const scheduledJob = await agenda.now(immediateJobName, payload);
    await completed;
    clearTimeout(timeout);

    const jobs = await agenda.jobs({ _id: scheduledJob.attrs._id });

    jobs.length.should.equal(1);
    jobs[0].attrs.lastFinishedAt.should.be.instanceof(Date);
  });

  it('unlocks only unfinished jobs after a worker restart', async function () {
    const jobs = mongoClient.db().collection('agendaJobs');
    const marker = 'anonymous-unlock-integration-test';
    const lockedAt = new Date(Date.now() - 60 * 1000);
    const futureRun = new Date(Date.now() + 60 * 60 * 1000);

    await jobs.insertMany([
      {
        name: `${marker}-unfinished`,
        lockedAt,
        lastModifiedBy: 'stopped-worker',
        lastRunAt: lockedAt,
        nextRunAt: null,
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
      },
    ]);

    try {
      await new Promise(function (resolve, reject) {
        worker.unlockAgendaJobs(function (err) {
          if (err) reject(err);
          else resolve();
        });
      });

      const [unfinished, finished, scheduled] = await Promise.all([
        jobs.findOne({ name: `${marker}-unfinished` }),
        jobs.findOne({ name: `${marker}-finished` }),
        jobs.findOne({ name: `${marker}-scheduled` }),
      ]);

      unfinished.should.not.have.property('lockedAt');
      unfinished.should.not.have.property('lastModifiedBy');
      unfinished.should.not.have.property('lastRunAt');
      unfinished.nextRunAt.should.be.instanceof(Date);
      unfinished.nextRunAt.getTime().should.be.above(lockedAt.getTime());

      finished.lockedAt.getTime().should.equal(lockedAt.getTime());
      finished.nextRunAt.getTime().should.equal(futureRun.getTime());
      scheduled.should.not.have.property('lockedAt');
      scheduled.nextRunAt.getTime().should.equal(futureRun.getTime());
    } finally {
      await jobs.deleteMany({ name: { $regex: `^${marker}-` } });
    }
  });
});
