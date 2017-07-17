var request = require('supertest'),
    async = require('async'),
    path = require('path'),
    mongoose = require('mongoose'),
    should = require('should'),
    User = mongoose.model('User'),
    express = require(path.resolve('./config/lib/express'));

describe('Search users: GET /users?search=string', function () {

  var agent;

  // initialize the testing environment
  before(function() {
    // Get application
    var app = express.init(mongoose);
    agent = request.agent(app);
  });

  // clear the database
  afterEach(function (done) {
    async.each([User], function (collection, cb) {
      collection.remove().exec(cb);
    }, done);
  });


  function createUsers(users, callback) {
    var createdUsers = [];
    async.eachOfSeries(users, function (user, index, cb) {
      var createdUser = new User({
        username: user.username || 'user' + index,
        firstName: user.firstName || 'firstName' + index,
        lastName: user.lastName || 'lastName' + index,
        get email() { return this.username + '@example.com'; },
        displayName: 'Full Name',
        get emailTemporary() { return this.email; },
        emailToken: 'initial email token',
        get displayUsername() { return this.username; },
        password: user.password || '******password',
        provider: 'local'
      });

      createdUsers.push(createdUser);
      createdUser.save(cb);
    }, function (err) {
      callback(err, createdUsers);
    });
  }


  context('not logged in', function () {
    it('Forbidden 403');
  });

  context('logged in', function () {

    var loggedUser;

    // create logged user
    beforeEach(function (done) {
      createUsers([{ username: 'loggedUser', password: 'somepassword' }], function (err, users) {
        loggedUser = users[0];

        done(err);
      });
    });

    // sign in
    beforeEach(function (done) {
      agent.post('/api/auth/signin')
        .send({ username: loggedUser.username, password: 'somepassword' })
        .expect(200)
        .end(done);
    });

    // sign out
    afterEach(function (done) {
      agent.get('/api/auth/signout')
        .expect(302)
        .end(done);
    });

    context('valid request', function () {
      it('[some usernames matched] return array of users', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { username: 'asdf' },
              { username: 'asdfg' },
              { username: 'asdia' },
              { username: 'hasdfg' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=asd')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users starting with asd
          function (foundUsers, cb) {

            should(foundUsers).length(3);

            cb();
          }
        ], done);
      });
      it('[some given names matched] return array of users');
      it('[some family names matched] return array of users');
      it('[none matched] return empty array');
      it('the user data should have fields from miniProfile');
      it('[many users matched] limit the amount (5-10, config)');
      it('search is case insensitive');
      it('return only active users');
    });

    context('invalid request', function () {
      it('[query string is less than 3 characters long] respond with 400');
      it('[query string contains invalid characters] respond with 400');
    });
  });
});
