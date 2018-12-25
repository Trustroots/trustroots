'use strict';

var request = require('supertest'),
    async = require('async'),
    _ = require('lodash'),
    path = require('path'),
    sinon = require('sinon'),
    mongoose = require('mongoose'),
    should = require('should'),
    User = mongoose.model('User'),
    express = require(path.resolve('./config/lib/express')),
    config = require(path.resolve('./config/config')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller'));

describe('Search users: GET /users?search=string', function () {

  var agent;

  var limit = 9;

  // initialize the testing environment
  before(function () {
    // Get application
    var app = express.init(mongoose.connection);
    agent = request.agent(app);
  });

  // rebuild indexes before tests
  before(function (done) {
    User.ensureIndexes(done);
  });

  // clear the database
  afterEach(function (done) {
    async.each([User], function (collection, cb) {
      collection.remove().exec(cb);
    }, done);
  });

  beforeEach(function () {
    sinon.stub(config.limits, 'userSearchLimit').value(limit);
  });

  afterEach(function () {
    sinon.restore();
  });


  function createUsers(users, callback) {
    var createdUsers = [];
    async.eachOfSeries(users, function (user, index, cb) {
      var createdUser = new User({
        username: user.username || 'user' + index,
        firstName: user.firstName || 'firstName' + index,
        lastName: user.lastName || 'lastName' + index,
        get email() { return this.username + '@example.com'; },
        get displayName() { return this.firstName + ' ' + this.lastName; },
        get emailTemporary() { return this.email; },
        emailToken: 'initial email token',
        get displayUsername() { return this.username; },
        password: user.password || '******password',
        provider: 'local',
        public: _.has(user, 'public') ? user.public : true,
        gender: 'non-binary',
        locationFrom: 'Wonderland',
        locationLiving: 'La Islantilla'

      });

      createdUsers.push(createdUser);
      createdUser.save(cb);
    }, function (err) {
      callback(err, createdUsers);
    });
  }


  context('not logged in', function () {
    it('Forbidden 403', function (done) {
      agent.get('/api/users?search=aaaBc')
        .expect(403)
        .end(done);
    });
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
      it('[a username matched] return array of users', function (done) {
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
            agent.get('/api/users?search=asdia')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(1);

            cb();
          }
        ], done);
      });

      it('[some given names matched] return array of users', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { firstName: 'qwer' },
              { firstName: 'qwera' },
              { firstName: 'qwery' },
              { firstName: 'qwer' },
              { firstName: 'qwe' },
              { firstName: 'sqwero' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=qwer')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(2);

            cb();
          }
        ], done);
      });

      it('[some family names matched] return array of users', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { lastName: 'zxcvbna' },
              { lastName: 'zxcvbnrya' },
              { lastName: 'zxcvb' },
              { lastName: 'zxcvbny' },
              { lastName: 'zxcvb' },
              { lastName: 'zxcvba' },
              { lastName: 'zxcvz' },
              { lastName: 'asdia' },
              { lastName: 'hasdfg' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=zxcvb')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(2);

            cb();
          }
        ], done);
      });

      it('[full names matched] return array of users', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { firstName: 'jacob', lastName: 'alia' },
              { firstName: 'jacob', lastName: 'alib' },
              { firstName: 'jAcob', lastName: 'alic' },
              { firstName: 'jaCob', lastName: 'alid' },
              { firstName: 'jacob', lastName: 'aliE' },
              { firstName: 'jacob', lastName: 'alIA' },
              { firstName: 'jaco', lastName: 'alg' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=jacob+aLia')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(6);

            cb();
          }
        ], done);
      });

      it('[none matched] return empty array', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { lastName: 'zxcvbna' },
              { username: 'zxcvba' },
              { firstName: 'xcvz' },
              { lastName: 'asdia' },
              { username: 'hasdfg' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=aeiou')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(0);

            cb();
          }
        ], done);
      });

      it('the user data should have only fields from searchProfile, and score', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { username: 'aaa' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=aaa')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(1);

            // _id is not specified in userSearchProfileFields, but gets included anyways
            // that's just how mongo works
            var expectedFields = userHandler.userSearchProfileFields.split(' ').concat(['_id']);
            var actualFields = _.keys(foundUsers[0]);

            var unexpectedFields = _.difference(actualFields, expectedFields);

            should(unexpectedFields).eql(['score']);

            cb();
          }
        ], done);
      });

      it('[many users matched] limit the amount (5-10, config)', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { username: 'aaaaaa' },
              { firstName: 'aaaaaa' },
              { lastName: 'aaaaaa' },
              { lastName: 'aaaaaa' },
              { firstName: 'aAaAaa' },
              { lastName: 'aaaaaa' },
              { firstName: 'aaaaaa' },
              { lastName: 'aaaaaa' },
              { firstName: 'aaaaaa' },
              { lastName: 'aaaaaa' },
              { firstName: 'aaaaaa' },
              { lastName: 'aaaaaa' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=aaaaaa')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(limit);

            cb();
          }
        ], done);
      });

      it('search is case insensitive', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { username: 'abcdef' },
              { firstName: 'abCdef' },
              { lastName: 'ABCdEF' },
              { username: 'aabc' }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=abcdEf')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(3);

            cb();
          }
        ], done);
      });

      it('return only public users', function (done) {
        async.waterfall([

          // create some users
          function (cb) {
            createUsers([
              { username: 'aabcdef', public: true },
              { firstName: 'aAabCd', public: false },
              { lastName: 'aaABCc', public: false },
              { lastName: 'aaABCc', public: true }, // this one is not matched
              { firstName: 'aabCDef', lastName: 'aAbcdef', public: true }
            ], cb);
          },

          // search
          function (users, cb) {
            agent.get('/api/users?search=aabcdef')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body);
              });
          },

          // check that we found the users
          function (foundUsers, cb) {

            should(foundUsers).length(2);

            cb();
          }
        ], done);
      });
    });

    context('invalid request', function () {
      it('[query string is less than 3 characters long] respond with 400', function (done) {
        agent.get('/api/users?search=aa')
          .expect(400)
          .end(function (err, res) {
            should(res.body.message).eql('Bad request.');
            should(res.body.detail).eql('Query string should be at least 3 characters long.');
            done(err);
          });
      });
    });
  });
});
