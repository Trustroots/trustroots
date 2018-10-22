'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
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

  var users;


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

  afterEach(utils.clearDatabase.bind(this, ['User']));

  context('logged in as public user', function () {

    beforeEach(utils.signIn.bind(this, _.pick(_usersPublic[0], ['username', 'password']), agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userFrom] respond with all public references from userFrom', function (done) {
      agent
        .get('/api/references?userFrom=' + users[2]._id)
        .expect(200)
        .end(done);
      // @TODO the test is not implemented yet!!!
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
