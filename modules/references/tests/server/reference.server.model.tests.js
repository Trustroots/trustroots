'use strict';

var should = require('should'),
    mongoose = require('mongoose'),
    path = require('path'),
    utils = require(path.resolve('./testutils/data.server.testutils')),
    User = mongoose.model('User'),
    Reference = mongoose.model('Reference');

describe('Reference Model Unit Tests', function () {

  describe('Method Save', function () {

    var user1,
        user2,
        user3;

    beforeEach(function () {
      user1 = new User({
        username: 'user1',
        email: 'user1@example.com',
        password: 'correcthorsebatterystaples'
      });

      user2 = new User({
        username: 'user2',
        email: 'user2@example.com',
        password: 'correcthorsebatterystaples'
      });

      user3 = new User({
        username: 'user3',
        email: 'user3@example.com',
        password: 'correcthorsebatterystaples'
      });
    });

    afterEach(utils.clearDatabase);

    it('save both directions without problems', function (done) {
      var reference1 = new Reference({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: true,
          hostedMe: true,
          hostedThem: false
        },
        recommend: 'no'
      });

      var reference2 = new Reference({
        userFrom: user2._id,
        userTo: user1._id,
        interactions: {
          met: true,
          hostedMe: false,
          hostedThem: true
        },
        recommend: 'yes'
      });

      reference1.save(function (err) {
        try {
          should.not.exist(err);
        } catch (e) {
          return done(e);
        }
        reference2.save(function (err) {
          try {
            should.not.exist(err);
          } catch (e) {
            return done(e);
          }
          return done();
        });
      });
    });

    it('save multiple references from one user to different users without problems', function (done) {
      var reference1 = new Reference({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: true,
          hostedMe: true,
          hostedThem: false
        },
        recommend: 'no'
      });

      var reference2 = new Reference({
        userFrom: user1._id,
        userTo: user3._id,
        interactions: {
          met: true,
          hostedMe: false,
          hostedThem: true
        },
        recommend: 'yes'
      });

      reference1.save(function (err) {
        try {
          should.not.exist(err);
        } catch (e) {
          return done(e);
        }
        reference2.save(function (err) {
          try {
            should.not.exist(err);
          } catch (e) {
            return done(e);
          }
          return done();
        });
      });
    });

    it('show error when saving invalid values of \'met\', \'recommend\', \'hostedMe\', \'hostedThem\'', function (done) {
      var reference = new Reference({
        userFrom: user1._id,
        userTo: user2._id,
        interactions: {
          met: 'foo',
          hostedMe: 'foolme',
          hostedThem: 'foolthem'
        },
        recommend: 'bar'
      });

      reference.save(function (err) {
        try {
          should.exist(err);
          should(err).match({ errors: {
            'interactions.met': { value: 'foo', kind: 'Boolean' },
            'interactions.hostedMe': { value: 'foolme', kind: 'Boolean' },
            'interactions.hostedThem': { value: 'foolthem', kind: 'Boolean' },
            recommend: { value: 'bar', kind: 'enum' }
          } });
        } catch (e) {
          return done(e);
        }

        return done();
      });
    });

    it('show error when saving duplicate reference (reference (from, to) already exists)', function (done) {
      var reference1 = new Reference({
        userFrom: user2._id,
        userTo: user1._id
      });

      var reference2 = new Reference({
        userFrom: user2._id,
        userTo: user1._id
      });

      reference1.save(function (err) {
        try {
          should.not.exist(err);
        } catch (e) {
          return done(e);
        }
        reference2.save(function (err) {
          try {
            should.exist(err);
            should(err).have.property('errors').match({
              userFrom: { kind: 'unique' },
              userTo: { kind: 'unique' }
            });
          } catch (e) {
            return done(e);
          }
          return done();
        });
      });
    });
  });
});
