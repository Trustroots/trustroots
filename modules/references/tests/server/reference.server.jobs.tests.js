const moment = require('moment');
const mongoose = require('mongoose');
const path = require('path');
const should = require('should');
const sinon = require('sinon');
const util = require('util');
const config = require(path.resolve('./config/config'));
const jobPublishReference = require('../../server/jobs/references-publish.server.job');
const utils = require(path.resolve('./testutils/data.server.testutils'));
const Reference = mongoose.model('Reference');

describe('Job: Set reference to public after a given period of time', () => {

  // fake Date
  // stub config.limits.timeToReplyReference with custom test value
  beforeEach(() => {
    sinon.useFakeTimers({ now: new Date('2018-10-12 11:33:21.312'), toFake: ['Date'] });
    sinon.stub(config.limits, 'timeToReplyReference').value({ days: 7 });
  });

  afterEach(() => {
    sinon.restore();
  });

  // delete references after each test
  afterEach(utils.clearDatabase);

  function generateReferenceData() {
    return {
      userFrom: new mongoose.Types.ObjectId(),
      userTo: new mongoose.Types.ObjectId(),
      // here we don't care if all interactions are false
      interactions: {
        met: true,
        hostedMe: false,
        hostedThem: true
      },
      recommend: 'yes'
    };
  }

  async function createReferences(count) {
    const references = [];

    for (let i = 0; i < count; ++i) {
      references.push(new Reference(generateReferenceData()));
    }

    for (const reference of references) {
      await reference.save();
    }
  }

  async function countPublicReferences() {
    const references = await Reference.find({ public: true }).exec();
    return references.length;
  }

  function wait(duration) {
    sinon.clock.tick(moment.duration(duration).asMilliseconds());
  }

  async function runJobAndExpectPublicReferences(expectedCount) {
    // promisify job and run it
    await util.promisify(jobPublishReference)(null);
    // count the references which are public
    const actualCount = await countPublicReferences();
    // test
    should(actualCount).eql(expectedCount);
  }

  it('non-public references older than a given period of time become public', async () => {
    // create some non-public references
    await createReferences(7);
    // wait for some time less than the given period
    wait({ days: 3 });
    // create some more references
    await createReferences(4);
    // run the job and see that all the references are private
    await runJobAndExpectPublicReferences(0);
    // wait so the older references can become public
    wait({ days: 4, seconds: 1 });
    // run the job and see that the older references are public now
    await runJobAndExpectPublicReferences(7);
    // wait longer
    wait({ days: 3 });
    // run the job and see that all the references are public now
    await runJobAndExpectPublicReferences(11);
  });
});
