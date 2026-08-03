const Agenda = require('agenda');
const MongoClient = require('mongodb').MongoClient;
const config = require('../../../../config/config');
const worker = require('../../../../config/lib/worker');
require('should');

describe('Agenda integration tests', function () {
  const collection = 'agendaIntegrationJobs';
  const immediateJobName = 'agenda integration immediate job';
  const recurringJobName = 'agenda integration recurring job';
  let agenda;
  let mongoClient;

  before(async function () {
    mongoClient = await MongoClient.connect(config.db.uri);
    agenda = new Agenda({
      db: {
        address: config.db.uri,
        collection,
      },
      processEvery: 50,
    });
    await agenda._ready;
  });

  after(async function () {
    await agenda.cancel({
      name: { $in: [immediateJobName, recurringJobName] },
    });
    await agenda.stop();
    await agenda.close();
    await mongoClient.close();
  });

  it('persists one recurring job when scheduling is repeated', async function () {
    agenda.define(recurringJobName, function () {});

    await agenda.every('5 minutes', recurringJobName);
    await agenda.every('5 minutes', recurringJobName);

    const jobs = await agenda.jobs({ name: recurringJobName });

    jobs.length.should.equal(1);
    jobs[0].attrs.type.should.equal('single');
    jobs[0].attrs.repeatInterval.should.equal('5 minutes');
    jobs[0].attrs.nextRunAt.should.be.instanceof(Date);
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

  it('unlocks unfinished jobs after a worker restart', async function () {
    const jobs = mongoClient.db().collection('agendaJobs');
    const marker = 'anonymous-unlock-integration-test';

    await jobs.insertOne({
      name: marker,
      lockedAt: new Date(),
      lastModifiedBy: 'stopped-worker',
      lastRunAt: new Date(),
      nextRunAt: null,
    });

    await new Promise(function (resolve, reject) {
      worker.unlockAgendaJobs(function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const unlockedJob = await jobs.findOne({ name: marker });

    unlockedJob.should.not.have.property('lockedAt');
    unlockedJob.should.not.have.property('lastModifiedBy');
    unlockedJob.should.not.have.property('lastRunAt');
    unlockedJob.nextRunAt.should.be.instanceof(Date);

    await jobs.deleteOne({ name: marker });
  });
});
