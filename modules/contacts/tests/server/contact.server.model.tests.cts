import type {
  ContactDocument,
  ContactModel,
  ContactRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model<UserRecord, UserModel>('User');
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');

/**
 * Globals
 */
let user1: UserModelDocument;
let user2: UserModelDocument;
let user1Id: UserModelDocument['_id'];
let user2Id: UserModelDocument['_id'];
let contact: ContactDocument;

/**
 * Unit tests
 */
describe('Contact Model Unit Tests:', function () {
  beforeEach(function (done) {
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123!',
      provider: 'local',
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123!',
      provider: 'local',
    });

    // Create users
    user1.save(function () {
      user1Id = user1._id;

      user2.save(function () {
        user2Id = user2._id;

        // Create connection between users
        contact = new Contact({
          userFrom: user1Id,
          userTo: user2Id,
          created: new Date(),
          confirmed: true,
        });

        done();
      });
    });
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      contact.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to save without `userFrom`', function (done) {
      contact.userFrom = '';

      contact.save(function (err) {
        should.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to save without `userTo`', function (done) {
      contact.userTo = '';

      contact.save(function (err) {
        should.exist(err);
        return done();
      });
    });
  });
});
