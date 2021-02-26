const moment = require('moment');
const mongoose = require('mongoose');
const path = require('path');
const should = require('should');
const sinon = require('sinon');
const util = require('util');
const config = require(path.resolve('./config/config'));
const jobPublishExperience = require('../../server/jobs/experiences-publish.server.job');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const Experience = mongoose.model('Experience');

describe('Job: Set experience to public after a given period of time', () => {
  // fake Date
  // stub config.limits.timeToReplyExperience with custom test value
  beforeEach(() => {
    sinon.useFakeTimers({
      now: new Date('2018-10-12 11:33:21.312'),
      toFake: ['Date'],
    });
    sinon.stub(config.limits, 'timeToReplyExperience').value({ days: 7 });
  });

  afterEach(() => {
    sinon.restore();
  });

  // delete experiences after each test
  afterEach(utils.clearDatabase);

  function generateExperienceData() {
    return {
      userFrom: new mongoose.Types.ObjectId(),
      userTo: new mongoose.Types.ObjectId(),
      // here we don't care if all interactions are false
      interactions: {
        met: true,
        guest: false,
        host: true,
      },
      recommend: 'yes',
    };
  }

  async function createExperiences(count) {
    const experiences = [];

    for (let i = 0; i < count; ++i) {
      experiences.push(new Experience(generateExperienceData()));
    }

    for (const experience of experiences) {
      await experience.save();
    }
  }

  async function countPublicExperiences() {
    const experiences = await Experience.find({ public: true }).exec();
    return experiences.length;
  }

  function wait(duration) {
    sinon.clock.tick(moment.duration(duration).asMilliseconds());
  }

  async function runJobAndExpectPublicExperiences(expectedCount) {
    // promisify job and run it
    await util.promisify(jobPublishExperience)(null);
    // count the experiences which are public
    const actualCount = await countPublicExperiences();
    // test
    should(actualCount).eql(expectedCount);
  }

  it('non-public experiences older than a given period of time become public', async () => {
    // create some non-public experiences
    await createExperiences(7);
    // wait for some time less than the given period
    wait({ days: 3 });
    // create some more experiences
    await createExperiences(4);
    // run the job and see that all the experiences are private
    await runJobAndExpectPublicExperiences(0);
    // wait so the older experiences can become public
    wait({ days: 4, seconds: 1 });
    // run the job and see that the older experiences are public now
    await runJobAndExpectPublicExperiences(7);
    // wait longer
    wait({ days: 3 });
    // run the job and see that all the experiences are public now
    await runJobAndExpectPublicExperiences(11);
  });
});
