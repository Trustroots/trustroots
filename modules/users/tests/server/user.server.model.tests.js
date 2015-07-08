'use strict';

/**
 * Module dependencies.
 */
var should = require('should'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

/**
 * Globals
 */
var user, user2;

/**
 * Unit tests
 */
describe('User Model Unit Tests:', function() {
  before(function(done) {
    user = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: 'user1',
      password: 'password123',
      provider: 'local'
    });
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: 'user1',
      password: 'password123',
      provider: 'local'
    });

    done();
  });

  describe('Method Save', function() {
    it('should begin with no users', function(done) {
      User.find({}, function(err, users) {
        users.should.have.length(0);
        done();
      });
    });

    it('should be able to save without problems', function(done) {
      user.save(done);
    });

    it('should fail to save an existing user again', function(done) {
      user.save();
      return user2.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should be able to show an error when try to save without first name', function(done) {
      user.firstName = '';
      return user.save(function(err) {
        should.exist(err);
        user.firstName = 'Full';
        done();
      });
    });

    it('should be able to show an error when try to save with too short password', function(done) {
      user.password = 'short';
      return user.save(function(err) {
        should.exist(err);
        user.password = 'password123';
        done();
      });
    });
  });

  describe('Username Validation',function(){
    it('should show error to save username beginning with .', function(done){
      user.username = '.login';
      return user.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should show error to save username end with .', function(done){
      user.username = 'login.';
      return user.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should show error to save username  with ..', function(done){
      user.username = 'log..in';
      return user.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should show error to save username shorter than 3 character', function(done){
      user.username = 'lo';
      return user.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should show error saving a username without at least one alphanumeric character', function(done){
      user.username = '-_-';
      return user.save(function(err) {
        should.exist(err);
        done();
      });
    });

    it('should save username longer than 32 characters', function(done){
      user.username = '1234567890' + '1234567890' + '1234567890' + '1234a';
      return user.save(function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should save username with dot', function(done){
      user.username = 'log.in';
      return user.save(function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  after(function(done) {
    User.remove().exec();
    done();
  });
});
