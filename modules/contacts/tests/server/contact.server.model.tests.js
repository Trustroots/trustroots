'use strict';

/**
 * Module dependencies.
 */
var should = require('should'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Contact = mongoose.model('Contact');

/**
 * Globals
 */
var user1, user2, user1Id, user2Id, contact;

/**
 * Unit tests
 */
describe('Contact Model Unit Tests:', function() {

  beforeEach(function(done) {

    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123!',
      provider: 'local'
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123!',
      provider: 'local'
    });

    // Create users
    user1.save(function(user1Err, user1Res) {

      user1Id = user1Res._id;

      user2.save(function(user2Err, user2Res) {

        user2Id = user2Res._id;

        // Create connection between users
        contact = new Contact({
          users: [user1Id, user2Id],
          created: new Date(),
          confirmed: true
        });

        done();

      });

    });

  });

  describe('Method Save', function() {
    it('should be able to save without problems', function(done) {

      return contact.save(function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save without users', function(done) {
      contact.users = '';

      return contact.save(function(err, res) {
        should.exist(err);
        done();
      });
    });

  });

  afterEach(function(done) {
    Contact.remove().exec(function() {
      User.remove().exec(done);
    });
  });
});
