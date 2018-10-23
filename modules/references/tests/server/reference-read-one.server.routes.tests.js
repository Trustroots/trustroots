'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    utils = require('./utils'),
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

  var users; // eslint-disable-line no-unused-vars

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

    it('read a single public reference by id', function (done) {
      agent
        .get('/api/references/0123456789ab0123456789ab')
        .expect(200)
        .end(done);
      // @TODO the test is not implemented!
    });

    it('read a single private reference if it is from self');
    it('can not read private references other than from self');
    it('[invalid referenceId] 400');
  });

  context('logged in as non-public user', function () {
    beforeEach(utils.signIn.bind(this, _.pick(_usersPrivate[0], ['username', 'password']), agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', function (done) {
      agent
        .get('/api/references/0123456789ab0123456789ab')
        .expect(403)
        .end(done);
    });
  });

  context('not logged in', function () {
    it('403', function (done) {
      agent
        .get('/api/references/0123456789ab0123456789ab')
        .expect(403)
        .end(done);
    });
  });
});
