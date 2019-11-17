const should = require('should');
const mongoose = require('mongoose');
const path = require('path');
const utils = require(path.resolve('./testutils/data.server.testutils'));
const User = mongoose.model('User');
const Reference = mongoose.model('Reference');

describe('Reference Model Unit Tests', () => {

  describe('Method Save', () => {

    let user1;
    let user2;
    let user3;

    beforeEach(() => {
      [user1, user2, user3] = utils.generateUsers(3).map(_user => new User(_user));
    });

    afterEach(utils.clearDatabase);

    it('save both directions without problems', async () => {
      const reference1 = new Reference({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: true,
          hostedMe: true,
          hostedThem: false
        },
        recommend: 'no'
      });

      const reference2 = new Reference({
        userFrom: user2._id,
        userTo: user1._id,
        interactions: {
          met: true,
          hostedMe: false,
          hostedThem: true
        },
        recommend: 'yes'
      });

      await should(reference1.save()).be.resolved();
      await should(reference2.save()).be.resolved();
    });

    it('save multiple references from one user to different users without problems', async () => {
      const reference1 = new Reference({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: true,
          hostedMe: true,
          hostedThem: false
        },
        recommend: 'no'
      });

      const reference2 = new Reference({
        userFrom: user1._id,
        userTo: user3._id,
        interactions: {
          met: true,
          hostedMe: false,
          hostedThem: true
        },
        recommend: 'yes'
      });

      await should(reference1.save()).be.resolved();
      await should(reference2.save()).be.resolved();
    });

    it('show error when saving invalid values of \'met\', \'recommend\', \'hostedMe\', \'hostedThem\'', async () => {
      const reference = new Reference({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: 'foo',
          hostedMe: 'foolme',
          hostedThem: 'foolthem'
        },
        recommend: 'bar'
      });

      const err = await should(reference.save()).be.rejected();
      should(err).match({ errors: {
        'interactions.met': { value: 'foo', kind: 'Boolean' },
        'interactions.hostedMe': { value: 'foolme', kind: 'Boolean' },
        'interactions.hostedThem': { value: 'foolthem', kind: 'Boolean' },
        recommend: { value: 'bar', kind: 'enum' }
      } });
    });

    it('show error when saving duplicate reference (reference (from, to) already exists)', async () => {
      const reference1 = new Reference({
        userFrom: user2._id,
        userTo: user1._id
      });

      const reference2 = new Reference({
        userFrom: user2._id,
        userTo: user1._id
      });

      // the first reference should be successfully saved
      await should(reference1.save()).be.resolved();

      // the second reference should fail with unique error
      const err = await should(reference2.save()).be.rejected();
      should(err).have.property('errors').match({
        userFrom: { kind: 'unique' },
        userTo: { kind: 'unique' }
      });
    });
  });
});
