const _ = require('lodash');
const path = require('path');
const sinon = require('sinon');

describe('Worker tests', () => {
  const agenda = require(path.resolve('./config/lib/agenda'));
  const worker = require(path.resolve('./config/lib/worker'));

  const workerOptions = {
    maxAttempts: 3,
    retryDelaySeconds: 3,
  };

  let failHandler;
  const definedJobs = [];
  const scheduledJobs = [];

  beforeEach(() => {
    // Reset

    definedJobs.length = 0;
    scheduledJobs.length = 0;

    // Stub out all of agendas functionality as we are not testing agenda

    sinon.stub(agenda, 'start').callsFake(() => {});

    // Pass through agenda.on('ready')
    // Save handler for agenda.on('fail')

    sinon.stub(agenda, 'on').callsFake((name, fn) => {
      if (name === 'ready') {
        process.nextTick(fn);
      } else if (name === 'fail') {
        failHandler = fn;
      }
    });

    // Collect calls to agenda.define() and agenda.every()

    sinon.stub(agenda, 'define').callsFake((name, options, fn) => {
      definedJobs.push({ name, options, fn });
    });

    sinon.stub(agenda, 'every').callsFake((repeat, name) => {
      scheduledJobs.push({ repeat, name });
    });

    // Allow for easily maths for nextRunAt calculations

    sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    worker.removeExitListeners();
  });

  beforeEach(done => {
    worker.start(workerOptions, done);
  });

  it('will not retry with a non-network error', () => {
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

  it('will retry on ECONNREFUSED', () => {
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

  it('will retry on ECONNRESET', () => {
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

  it('will not retry when max retries is reached', () => {
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

  it('defines [send email] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send email');
  });

  it('defines [check unread messages] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('check unread messages');
  });

  it('defines [daily statistics] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('daily statistics');
  });

  it('defines [send signup reminders] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send signup reminders');
  });

  it('defines [reactivate hosts] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('reactivate hosts');
  });

  it('defines [welcome sequence first] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('welcome sequence first');
  });

  it('defines [welcome sequence second] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('welcome sequence second');
  });

  it('defines [welcome sequence third] job', () => {
    const jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('welcome sequence third');
  });

  it('defines right number of repeating jobs', () => {
    scheduledJobs.length.should.equal(8);
  });

  it('only schedules defined jobs', () => {
    const jobNames = _.map(definedJobs, 'name');
    scheduledJobs.forEach(job => {
      job.name.should.be.oneOf(jobNames);
    });
  });
});
