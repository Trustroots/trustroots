'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    should = require('should'),
    utils = require('./utils'),
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

  var users/* ,
      references*/;

  var _usersPublic = utils.generateUsers(6, { public: true });
  var _usersPrivate = utils.generateUsers(3, {
    public: false,
    username: 'nonpublic',
    email: 'nonpublic@example.com'
  });
  var _users = _.concat(_usersPublic, _usersPrivate);

  beforeEach(function (done) {
    utils.saveUsers(_users, function (err, usrs) {
      users = usrs;
      return done(err);
    });
  });

  /**
   * array of [userFrom, userTo, values]
   *   0 1 2 3 4 5
   * 0 . T T T F T
   * 1 T . T T . T
   * 2 T . . T F T
   * 3 T . F . . .
   * 4 F . . . . .
   * 5 T . . . . .
   */
  var referenceData = [
    [0, 1], [0, 2], [0, 3], [0, 4, { public: false }], [0, 5],
    [1, 0], [1, 2], [1, 3], [1, 5],
    [2, 0], [2, 3], [2, 4, { public: false }], [2, 5],
    [3, 0], [3, 2, { public: false }],
    [4, 0, { public: false }],
    [5, 0]
  ];

  beforeEach(function (done) {
    var _references = utils.generateReferences(users, referenceData);

    utils.saveReferences(_references, function (err) {
      // references = refs;
      return done(err);
    });
  });

  afterEach(utils.clearDatabase.bind(this, ['Reference', 'User']));

  context('logged in as public user', function () {

    beforeEach(utils.signIn.bind(this, _.pick(_usersPublic[0], ['username', 'password']), agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userFrom] respond with all public references from userFrom', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          try {
            // user2 gave 3 public and 1 non-public references
            should(res.body).be.Array().of.length(3);
            return done();
          } catch (e) {
            return done(e);
          }
        });
    });

    it('[param userTo] respond with all public references to userTo');
    it('[params userFrom and userTo] respond with 1 or 0 public reference from userFrom to userTo');
    it('[userFrom is self] display all public and private references from userFrom');
    it('[no params] 400 and error');
  });

  context('logged in as non-public user', function () {
    beforeEach(utils.signIn.bind(this, _.pick(_usersPrivate[0], ['username', 'password']), agent));
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

describe('Read a single reference by reference id', function () {
  // GET /references/:referenceId
  // logged in public user can read a single public reference by id
  // .....                 can read a single private reference if it is from self
  // logged in public user can not read other private references
  context('logged in as public user', function () {
    it('read a single public reference by id');
    it('read a single private reference if it is from self');
    it('can not read private references other than from self');
  });

  context('logged in as non-public user', function () {
    it('403');
  });

  context('not logged in', function () {
    it('403');
  });
});
