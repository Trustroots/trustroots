/**
 * Module dependencies.
 */
const should = require('should');
const mongoose = require('mongoose');
const path = require('path');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Contact = mongoose.model('Contact');

/**
 * Globals
 */
let user1;
let user2;
let user1Id;
let user2Id;
let contact;

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
