'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    should = require('should'),
    sinon = require('sinon'),
    utils = require('./utils'),
    userProfile = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller')),
    express = require(path.resolve('./config/lib/express'));

describe('Read a single reference by reference id', function () {
  // GET /references/:referenceId
  // logged in public user can read a single public reference by id
  // .....                 can read a single private reference if it is from self
  // logged in public user can not read other private references
  var app = express.init(mongoose.connection);
  var agent = request.agent(app);

  var _usersPublic = utils.generateUsers(3, { public: true });
  var _usersPrivate = utils.generateUsers(1, { public: false, username: 'private', email: 'non@example.com' });
  var _users = _.concat(_usersPublic, _usersPrivate);

  var users,
      references;

  beforeEach(function () {
    sinon.useFakeTimers({ now: new Date('2019-01-13 13:21:55.1'), toFake: ['Date'] });
  });

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function (done) {
    utils.saveUsers(_users, function (err, usrs) {
      users = usrs;
      return done(err);
    });
  });

  /**
   *   0 1 2
   * 0 . T F
   * 1 F . T
   * 2 T F .
   */
  var referenceData = [
    [0, 1], [0, 2, { public: false }],
    [1, 0, { public: false }], [1, 2],
    [2, 0], [2, 1, { public: false }]
  ];

  beforeEach(function (done) {
    var _references = utils.generateReferences(users, referenceData);

    utils.saveReferences(_references, function (err, refs) {
      references = refs;
      return done(err);
    });
  });

  afterEach(utils.clearDatabase.bind(this, ['Reference', 'User']));

  context('logged in as public user', function () {

    beforeEach(utils.signIn.bind(this, _.pick(_usersPublic[0], ['username', 'password']), agent));
    afterEach(utils.signOut.bind(this, agent));

    it('read a single public reference by id', function (done) {
      agent
        .get('/api/references/' + references[3]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            var userFromExp = _.pick(users[1], userProfile.userMiniProfileFields.split(' ').slice(2));
            userFromExp._id = users[1]._id.toString();
            var userToExp = _.pick(users[2], userProfile.userMiniProfileFields.split(' ').slice(2));
            userToExp._id = users[2]._id.toString();

            should(res.body).eql({
              public: true,
              userFrom: userFromExp,
              userTo: userToExp,
              created: new Date().toISOString(),
              _id: references[3]._id.toString(),
              met: references[3].met,
              hostedMe: references[3].hostedMe,
              hostedThem: references[3].hostedThem,
              recommend: references[3].recommend
            });
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('read a single private reference if it is from self', function (done) {
      agent
        .get('/api/references/' + references[1]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            should(res.body).match({
              public: false,
              _id: references[1]._id.toString()
            });

            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[private references not from self] 404', function (done) {
      agent
        .get('/api/references/' + references[2]._id)
        .expect(404)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            should(res.body).eql({
              message: 'Not found.',
              detail: 'Reference not found.'
            });

            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[reference doesn\'t exist] 404', function (done) {
      agent
        .get('/api/references/' + 'a'.repeat(24))
        .expect(404)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            should(res.body).eql({
              message: 'Not found.',
              detail: 'Reference not found.'
            });

            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[invalid referenceId] 400');
  });

  context('logged in as non-public user', function () {
    beforeEach(utils.signIn.bind(this, _.pick(_usersPrivate[0], ['username', 'password']), agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', function (done) {
      agent
        .get('/api/references/' + references[3]._id)
        .expect(403)
        .end(done);
    });
  });

  context('not logged in', function () {
    it('403', function (done) {
      agent
        .get('/api/references/' + references[3]._id)
        .expect(403)
        .end(done);
    });
  });
});
