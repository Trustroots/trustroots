var _ = require('lodash'),
    path = require('path'),
    sinon = require('sinon');

describe('worker', function() {

  var agenda = require(path.resolve('./config/lib/agenda')),
      worker = require(path.resolve('./config/lib/worker'));

  var workerOptions = {
    maxAttempts: 3,
    retryDelaySeconds: 3
  };

  var sandbox = sinon.sandbox.create();

  var failHandler,
      definedJobs = [],
      scheduledJobs = [];

  beforeEach(function() {

    // Reset

    definedJobs.length = 0;
    scheduledJobs.length = 0;

    // Stub out all of agendas functionality as we are not testing agenda

    sandbox.stub(agenda, 'start');

    // Pass through agenda.on('ready')
    // Save handler for agenda.on('fail')

    sandbox.stub(agenda, 'on', function(name, fn) {
      if (name === 'ready') {
        process.nextTick(fn);
      } else if (name === 'fail') {
        failHandler = fn;
      }
    });

    // Collect calls to agenda.define() and agenda.every()

    sandbox.stub(agenda, 'define', function(name, options, fn) {
      definedJobs.push({ name: name, options: options, fn: fn });
    });

    sandbox.stub(agenda, 'every', function(repeat, name) {
      scheduledJobs.push({ repeat: repeat, name: name });
    });

    // Allow for easily maths for nextRunAt calculations

    sandbox.useFakeTimers();

  });

  afterEach(function() {
    sandbox.restore();
  });

  beforeEach(function(done) {
    worker.start(workerOptions, done);
  });

  it('will not retry with a non-network error', function() {
    var job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: 0
      },
      save: function() {}
    };
    var err = new Error('some regular error');
    var mock = sinon.mock(job).expects('save').never();
    failHandler(err, job);
    mock.verify();
  });

  it('will retry on ECONNREFUSED', function() {
    var job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts - 1
      },
      save: function() {}
    };
    var err = new Error('ECONNREFUSED');
    var mock = sinon.mock(job).expects('save').once();
    failHandler(err, job);
    job.attrs.nextRunAt.should.be.instanceof(Date);
    job.attrs.nextRunAt.getTime().should.equal(workerOptions.retryDelaySeconds * 1000);
    mock.verify();
  });

  it('will retry on ECONNRESET', function() {
    var job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts - 1
      },
      save: function() {}
    };
    var err = new Error('ECONNRESET');
    var mock = sinon.mock(job).expects('save').once();
    failHandler(err, job);
    job.attrs.nextRunAt.should.be.instanceof(Date);
    job.attrs.nextRunAt.getTime().should.equal(workerOptions.retryDelaySeconds * 1000);
    mock.verify();
  });

  it('will not retry when max retries is reached', function() {
    var job = {
      attrs: {
        _id: 'jobid',
        name: 'jobname',
        failCount: workerOptions.maxAttempts
      },
      save: function() {}
    };
    var err = new Error('ECONNRESET');
    var mock = sinon.mock(job).expects('save').never();
    failHandler(err, job);
    mock.verify();
  });

  it('defines [send email] job', function() {
    var jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('send email');
  });

  it('defines [check unread messages] job', function() {
    var jobNames = _.map(definedJobs, 'name');
    jobNames.should.containEql('check unread messages');
  });

  it('defines one repeating job', function() {
    scheduledJobs.length.should.equal(1);
  });

  it('only schedules defined jobs', function() {
    var jobNames = _.map(definedJobs, 'name');
    scheduledJobs.forEach(function(job) {
      job.name.should.be.oneOf(jobNames);
    });
  });

});
