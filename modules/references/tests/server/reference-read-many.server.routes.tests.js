'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    should = require('should'),
    sinon = require('sinon'),
    utils = require(path.resolve('./testutils/data.server.testutils')),
    userProfile = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller')),
    express = require(path.resolve('./config/lib/express'));

describe('Read references by userFrom Id or userTo Id', function () {
  // GET /references?userFrom=:UserId&userTo=:UserId

  // logged in public user can read all public references by userFrom
  // ...                   can read all public references by userTo
  // ...                   can read all public and private references from self
  // ...                   can not read private references to self
  // ...                   can read a specific reference by specifying userFrom and userTo
  // when userFrom or userTo doesn't exist, we simply return empty list
  var app = express.init(mongoose.connection);
  var agent = request.agent(app);

  var users;

  var _usersPublic = utils.generateUsers(6, { public: true });
  var _usersPrivate = utils.generateUsers(3, {
    public: false,
    username: 'nonpublic',
    email: 'nonpublic@example.com'
  });
  var _users = _.concat(_usersPublic, _usersPrivate);

  beforeEach(function () {
    sinon.useFakeTimers({ now: new Date('2018-01-12'), toFake: ['Date'] });
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
   * array of [userFrom, userTo, values]
   *
   * Overview of the referenceData
   * - row: userFrom - index of user within array of users provided to utils.generateReferences()
   * - column: userTo - same as row
   * - T: reference exists and is public
   * - F: reference exists and is not public
   * - .: reference doesn't exist
   *
   *   0 1 2 3 4 5
   * 0 . T T F F T
   * 1 T . T T . T
   * 2 T . . T F T
   * 3 T . F . . .
   * 4 F . . . . .
   * 5 T . . . . .
   */
  var referenceData = [
    [0, 1], [0, 2], [0, 3, { public: false }], [0, 4, { public: false }], [0, 5],
    [1, 0], [1, 2], [1, 3], [1, 5],
    [2, 0], [2, 3], [2, 4, { public: false }], [2, 5],
    [3, 0], [3, 2, { public: false }],
    [4, 0, { public: false }],
    [5, 0]
  ];

  beforeEach(function (done) {
    var _references = utils.generateReferences(users, referenceData);

    utils.saveReferences(_references, done);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', function () {

    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userFrom] respond with all public references from userFrom', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            // user2 gave 3 public and 1 non-public references
            should(res).have.property('body').which.is.Array().of.length(3);
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('the references in response have expected structure, userFrom & userTo have miniProfile', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            res.body.forEach(function (ref) {
              should(ref)
                .have.property('userFrom')
                .which.is.Object()
                .with.properties(userProfile.userMiniProfileFields.split(' ').slice(2, -1));

              should(ref)
                .have.property('userTo')
                .which.is.Object()
                .with.properties(userProfile.userMiniProfileFields.split(' ').slice(2, -1));

              should(ref).have.propertyByPath('interactions', 'met').Boolean();
              should(ref).have.propertyByPath('interactions', 'hostedMe').Boolean();
              should(ref).have.propertyByPath('interactions', 'hostedThem').Boolean();
              should(ref).have.property('public', true);
              should(ref).have.property('created', new Date().toISOString());
              should(ref).have.property('recommend').oneOf('yes', 'no', 'unknown');
              should(ref).have.property('_id').String().match(/[0-9a-f]{24}/);
            });

            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[param userTo] respond with all public references to userTo', function (done) {
      agent
        .get('/api/references?userTo=' + users[2]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            // user2 has received 2 public and 1 non-public reference
            should(res).have.property('body').which.is.Array().of.length(2);
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[params userFrom and userTo] respond with 1 or 0 public reference from userFrom to userTo', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id + '&userTo=' + users[5]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            // there is 1 public reference from user2 to user5
            should(res).have.property('body').which.is.Array().of.length(1);
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[userFrom is self] display all public and private references from userFrom', function (done) {
      agent
        .get('/api/references?userFrom=' + users[0]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            // user0 has given 3 public and 2 non-public reference
            // and should see all 5 of them
            should(res).have.property('body').which.is.Array().of.length(5);

            var nonpublic = res.body.filter(function (ref) { return !ref.public; });
            should(nonpublic).length(2);
            // the reference details are also present
            should(nonpublic[0]).have.keys('recommend', 'interactions');
            should(nonpublic[0].interactions).have.keys('met', 'hostedMe', 'hostedThem');

            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[userTo is self] private references are included in limited form (only userFrom, userTo, public, created)', function (done) {
      agent
        .get('/api/references?userTo=' + users[0]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            // user0 has received 4 public and 1 non-public reference
            // and should see all 5 of them
            // but the 1 non-public should have only fields userFrom, userTo, public, created
            should(res).have.property('body').which.is.Array().of.length(5);

            var nonpublic = res.body.filter(function (ref) { return !ref.public; });
            should(nonpublic).be.Array().of.length(1);
            should(nonpublic[0]).match({
              public: false,
              created: new Date().toISOString()
            });
            should(nonpublic[0]).have.only.keys('_id', 'userFrom', 'userTo', 'created', 'public');
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[no params] 400 and error', function (done) {
      agent
        .get('/api/references')
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            should(res.body).eql({
              message: 'Bad request.',
              details: {
                userFrom: 'missing',
                userTo: 'missing'
              }
            });
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[invalid params] 400 and error', function (done) {
      agent
        .get('/api/references?userFrom=asdf&userTo=1')
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            should(res.body).eql({
              message: 'Bad request.',
              details: {
                userFrom: 'invalid',
                userTo: 'invalid'
              }
            });
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });
  });

  context('logged in as non-public user', function () {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id)
        .expect(403)
        .end(done);
    });
  });

  context('not logged in', function () {
    it('403', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id)
        .expect(403)
        .end(done);
    });
  });
});
