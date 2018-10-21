'use strict';

var async = require('async'),
    crypto = require('crypto'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    path = require('path'),
    should = require('should'),
    sinon = require('sinon'),
    config = require(path.resolve('./config/config')),
    jobPublishReference = require('../../server/jobs/references-publish.server.job'),
    Reference = mongoose.model('Reference');

describe('Job: Set reference to public after a given period of time', function () {

  // fake Date
  // stub config.limits.timeToReplyReference with custom test value
  beforeEach(function () {
    sinon.useFakeTimers({ now: new Date('2018-10-12 11:33:21.312'), toFake: ['Date'] });
    sinon.stub(config.limits, 'timeToReplyReference').value({ days: 7 });
  });

  afterEach(function () {
    sinon.restore();
  });

  // delete references after each test
  afterEach(function (done) {
    Reference.deleteMany({}).exec(done);
  });

  function generateRandomId() {
    var result = crypto.randomBytes(12).toString('hex');
    // padding with 0 to 24 characters
    result = '0'.repeat(24 - result.length) + result;
    return result;
  }

  function generateRandomBoolean() {
    return !!Math.floor(2 * Math.random());
  }

  function generateRandomRecommend() {
    return ['yes', 'no', 'unknown'][Math.floor(3 * Math.random())];
  }

  var referenceData = {
    get userFrom() { return generateRandomId(); },
    get userTo() { return generateRandomId(); },
    // here we don't care if all interactions are false
    get met() { return generateRandomBoolean(); },
    get hostedMe() { return generateRandomBoolean(); },
    get hostedThem() { return generateRandomBoolean(); },
    get recommend() { return generateRandomRecommend(); }
  };

  function createReferences(count, done) {
    var references = [];

    for (var i = 0; i < count; ++i) {
      references.push(new Reference(referenceData));
    }
    async.eachSeries(references, function (reference, cb) { reference.save(cb); }, done);
  }

  function countPublicReferences(done) {
    return Reference.find({ public: true }).exec(function (err, resp) {
      return done(err, resp.length);
    });
  }

  function waitWithCallback(duration, done) {
    sinon.clock.tick(moment.duration(duration).asMilliseconds());
    return done();
  }

  function runJobAndExpectPublicReferences(expectedCount, done) {
    jobPublishReference(null, function (errJob) {
      if (errJob) return done(errJob);

      countPublicReferences(function (err, actualCount) {
        if (err) return done(err);

        try {
          should(actualCount).eql(expectedCount);
          return done();
        } catch (e) {
          return done(e);
        }
      });

    });
  }

  it('non-public references older than a given period of time become public', function (done) {
    return async.waterfall([
      // create some non-public references
      createReferences.bind(this, 7),
      // wait for some time less than the given period
      waitWithCallback.bind(this, { days: 3 }),
      // create some more references
      createReferences.bind(this, 4),
      // run the job and see that all the references are private
      runJobAndExpectPublicReferences.bind(this, 0),
      // wait so the older references can become public
      waitWithCallback.bind(this, { days: 4, seconds: 1 }),
      // run the job and see that the older references are public now
      runJobAndExpectPublicReferences.bind(this, 7),
      // wait longer
      waitWithCallback.bind(this, { days: 3 }),
      // run the job and see that all the references are public now
      runJobAndExpectPublicReferences.bind(this, 11)
    ], done);
  });
});
