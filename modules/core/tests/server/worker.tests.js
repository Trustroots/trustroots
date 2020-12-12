const _ = require('lodash');
const path = require('path');
const sinon = require('sinon');

describe('Worker tests', function () {
  const agenda = require(path.resolve('./config/lib/agenda'));
  const worker = require(path.resolve('./config/lib/worker'));

  const workerOptions = {
    maxAttempts: 3,
    retryDelaySeconds: 3,
  };

  let failHandler;
  const definedJobs = [];
  const scheduledJobs = [];

  beforeEach(function () {
    // Reset

    definedJobs.length = 0;
    scheduledJobs.length = 0;

    // Stub out all of agendas functionality as we are not testing agenda

    sinon.stub(agenda, 'start').callsFake(function () {});

    // Pass through agenda.on('ready')
    // Save handler for agenda.on('fail')

    sinon.stub(agenda, 'on').callsFake(function (name, fn) {
      if (name === 'ready') {
        process.nextTick(fn);
      } else if (name === 'fail') {
        failHandler = fn;
      }
    });

    // Collect calls to agenda.define() and agenda.every()

    sinon.stub(agenda, 'define').callsFake(function (name, options, fn) {
      definedJobs.push({ name, options, fn });
    });

    sinon.stub(agenda, 'every').callsFake(function (repeat, name) {
      scheduledJobs.push({ repeat, name });
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
    const job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: 0,
      },
      save() {},
    };
    const err = new Error('some regular error');
    const mock = sinon.mock(job).expects('save').never();
    failHandler(err, job);
    mock.verify();
  });

  it('will retry on ECONNREFUSED', function () {
    const job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts - 1,
      },
      save() {},
    };
    const err = new Error('ECONNREFUSED');
    const mock = sinon.mock(job).expects('save').once();
    failHandler(err, job);
    job.attrs.nextRunAt.should.be.instanceof(Date);
    job.attrs.nextRunAt
      .getTime()
      .should.equal(workerOptions.retryDelaySeconds * 1000);
    mock.verify();
  });

  it('will retry on ECONNRESET', function () {
    const job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts - 1,
      },
      save() {},
    };
    const err = new Error('ECONNRESET');
    const mock = sinon.mock(job).expects('save').once();
    failHandler(err, job);
    job.attrs.nextRunAt.should.be.instanceof(Date);
    job.attrs.nextRunAt
      .getTime()
      .should.equal(workerOptions.retryDelaySeconds * 1000);
    mock.verify();
  });

  it('will not retry when max retries is reached', function () {
    const job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts,
      },
      save() {},
    };
    const err = new Error('ECONNRESET');
    const mock = sinon.mock(job).expects('save').never();
    failHandler(err, job);
    mock.verify();
  });

  it('defines [send email] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send email');
  });

  it('defines [send facebook notification] job', function () {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send facebook notification');
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

  it('defines right number of repeating jobs', function () {
    scheduledJobs.length.should.equal(8);
  });

  it('only schedules defined jobs', function () {
    const jobNames = _.map(definedJobs, 'name');
    scheduledJobs.forEach(function (job) {
      job.name.should.be.oneOf(jobNames);
    });
  });
});
