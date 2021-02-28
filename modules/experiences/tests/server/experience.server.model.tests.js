const should = require('should');
const mongoose = require('mongoose');
const path = require('path');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const User = mongoose.model('User');
const Experience = mongoose.model('Experience');

describe('Experience Model Unit Tests', () => {
  describe('Method Save', () => {
    let user1;
    let user2;
    let user3;

    beforeEach(() => {
      [user1, user2, user3] = utils
        .generateUsers(3)
        .map(_user => new User(_user));
    });

    afterEach(utils.clearDatabase);

    it('save both directions without problems', async () => {
      const experience1 = new Experience({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: true,
          guest: true,
          host: false,
        },
        recommend: 'no',
      });

      const experience2 = new Experience({
        userFrom: user2._id,
        userTo: user1._id,
        interactions: {
          met: true,
          guest: false,
          host: true,
        },
        recommend: 'yes',
      });

      await should(experience1.save()).be.resolved();
      await should(experience2.save()).be.resolved();
    });

    it('save multiple experiences from one user to different users without problems', async () => {
      const experience1 = new Experience({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: true,
          guest: true,
          host: false,
        },
        recommend: 'no',
      });

      const experience2 = new Experience({
        userFrom: user1._id,
        userTo: user3._id,
        interactions: {
          met: true,
          guest: false,
          host: true,
        },
        recommend: 'yes',
      });

      await should(experience1.save()).be.resolved();
      await should(experience2.save()).be.resolved();
    });

    it("show error when saving invalid values of 'met', 'recommend', 'guest', 'host'", async () => {
      const experience = new Experience({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: 'foo',
          guest: 'foolme',
          host: 'foolthem',
        },
        recommend: 'bar',
      });

      const err = await should(experience.save()).be.rejected();
      should(err).match({
        errors: {
          'interactions.met': { value: 'foo', kind: 'Boolean' },
          'interactions.guest': { value: 'foolme', kind: 'Boolean' },
          'interactions.host': { value: 'foolthem', kind: 'Boolean' },
          recommend: { value: 'bar', kind: 'enum' },
        },
      });
    });

    it('show error when saving duplicate experience (experience (from, to) already exists)', async () => {
      const experience1 = new Experience({
        userFrom: user2._id,
        userTo: user1._id,
      });

      const experience2 = new Experience({
        userFrom: user2._id,
        userTo: user1._id,
      });

      // the first experience should be successfully saved
      await should(experience1.save()).be.resolved();

      // the second experience should fail with unique error
      const err = await should(experience2.save()).be.rejected();
      should(err)
        .have.property('errors')
        .match({
          userFrom: { kind: 'unique' },
          userTo: { kind: 'unique' },
        });
    });
  });
});
