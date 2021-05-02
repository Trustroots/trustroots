const request = require('supertest');
const async = require('async');
const _ = require('lodash');
const path = require('path');
const sinon = require('sinon');
const mongoose = require('mongoose');
const should = require('should');
const config = require(path.resolve('./config/config'));
const userHandler = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

describe('Search users: GET /users?search=string', function () {
  let agent;

  const limit = 9;

  // initialize the testing environment
  before(function () {
    // Stub the limit value
    sinon.stub(config.limits, 'paginationLimit').value(limit);

    // the limit is used in this config, so we needed to stub limit before importing this
    const express = require(path.resolve('./config/lib/express'));
    // Get application
    const app = express.init(mongoose.connection);
    agent = request.agent(app);
  });

  // rebuild indexes before tests
  before(function (done) {
    User.ensureIndexes(done);
  });

  afterEach(utils.clearDatabase);

  after(function () {
    sinon.restore();
  });

  function createUsers(users, callback) {
    const createdUsers = [];
    async.eachOfSeries(
      users,
      function (user, index, cb) {
        const createdUser = new User({
          username: user.username || 'user' + index,
          firstName: user.firstName || 'firstName' + index,
          lastName: user.lastName || 'lastName' + index,
          get email() {
            return this.username + '@example.com';
          },
          get displayName() {
            return this.firstName + ' ' + this.lastName;
          },
          get emailTemporary() {
            return this.email;
          },
          emailToken: 'initial email token',
          password: user.password || '******password',
          provider: 'local',
          public: _.has(user, 'public') ? user.public : true,
          gender: 'non-binary',
          locationFrom: 'Wonderland',
          locationLiving: 'La Islantilla',
        });

        createdUsers.push(createdUser);
        createdUser.save(cb);
      },
      function (err) {
        callback(err, createdUsers);
      },
    );
  }

  context('not logged in', function () {
    it('Forbidden 403', function (done) {
      agent.get('/api/users?search=aaaBc').expect(403).end(done);
    });
  });

  context('logged in', function () {
    let loggedUser;

    // create logged user
    beforeEach(function (done) {
      createUsers(
        [{ username: 'loggedUser', password: 'somepassword' }],
        function (err, users) {
          loggedUser = users[0];
          done(err);
        },
      );
    });

    // sign in
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send({ username: loggedUser.username, password: 'somepassword' })
        .expect(200)
        .end(done);
    });

    // sign out
    afterEach(function (done) {
      agent.get('/api/auth/signout').expect(302).end(done);
    });

    context('valid request', function () {
      it('[a username matched] return array of users', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { username: 'asdf' },
                  { username: 'asdfg' },
                  { username: 'asdia' },
                  { username: 'hasdfg' },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=asdia')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(1);

              cb();
            },
          ],
          done,
        );
      });

      it('[some given names matched] return array of users', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { firstName: 'qwer' },
                  { firstName: 'qwera' },
                  { firstName: 'qwery' },
                  { firstName: 'qwer' },
                  { firstName: 'qwe' },
                  { firstName: 'sqwero' },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=qwer')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(2);

              cb();
            },
          ],
          done,
        );
      });

      it('[some family names matched] return array of users', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { lastName: 'zxcvbna' },
                  { lastName: 'zxcvbnrya' },
                  { lastName: 'zxcvb' },
                  { lastName: 'zxcvbny' },
                  { lastName: 'zxcvb' },
                  { lastName: 'zxcvba' },
                  { lastName: 'zxcvz' },
                  { lastName: 'asdia' },
                  { lastName: 'hasdfg' },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=zxcvb')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(2);

              cb();
            },
          ],
          done,
        );
      });

      it('[full names matched] return array of users', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { firstName: 'jacob', lastName: 'alia' },
                  { firstName: 'jacob', lastName: 'alib' },
                  { firstName: 'jAcob', lastName: 'alic' },
                  { firstName: 'jaCob', lastName: 'alid' },
                  { firstName: 'jacob', lastName: 'aliE' },
                  { firstName: 'jacob', lastName: 'alIA' },
                  { firstName: 'jaco', lastName: 'alg' },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=jacob+aLia')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(6);

              cb();
            },
          ],
          done,
        );
      });

      it('[none matched] return empty array', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { lastName: 'zxcvbna' },
                  { username: 'zxcvba' },
                  { firstName: 'xcvz' },
                  { lastName: 'asdia' },
                  { username: 'hasdfg' },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=aeiou')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(0);

              cb();
            },
          ],
          done,
        );
      });

      it('the user data should have only fields from searchProfile, and score', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers([{ username: 'aaa' }], cb);
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=aaa')
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
              const expectedFields = userHandler.userSearchProfileFields
                .split(' ')
                .concat(['_id']);
              const actualFields = _.keys(foundUsers[0]);

              const unexpectedFields = _.difference(
                actualFields,
                expectedFields,
              );

              should(unexpectedFields).eql(['score']);

              cb();
            },
          ],
          done,
        );
      });

      context('limit the amount of results and pagination', function () {
        // create some users
        const testUsers = [
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
          { lastName: 'aaaaaa' },
        ];

        beforeEach(function (done) {
          createUsers(testUsers, function (err) {
            done(err);
          });
        });
        // TCs with different or missing page and limit parameters
        const pageTests = [
          { params: '', expected: limit },
          { params: '&page=1', expected: limit },
          { params: '&page=2', expected: testUsers.length - limit },
          { params: '&limit=11', expected: 11 },
          { params: '&page=1&limit=11', expected: 11 },
          { params: '&page=2&limit=11', expected: testUsers.length - 11 },
        ];

        pageTests.forEach(function (test) {
          it(
            'should limit results to ' +
              test.expected +
              ', when param is ' +
              test.params,
            function (done) {
              async.waterfall(
                [
                  // search
                  function (cb) {
                    agent
                      .get('/api/users?search=aaaaaa' + test.params)
                      .expect(200)
                      .end(function (err, response) {
                        cb(err, response.body);
                      });
                  },

                  // check that we found the users
                  function (foundUsers, cb) {
                    should(foundUsers).length(test.expected);
                    cb();
                  },
                ],
                done,
              );
            },
          );
        });
      });

      it('search is case insensitive', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { username: 'abcdef' },
                  { firstName: 'abCdef' },
                  { lastName: 'ABCdEF' },
                  { username: 'aabc' },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=abcdEf')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(3);

              cb();
            },
          ],
          done,
        );
      });

      it('return only public users', function (done) {
        async.waterfall(
          [
            // create some users
            function (cb) {
              createUsers(
                [
                  { username: 'aabcdef', public: true },
                  { firstName: 'aAabCd', public: false },
                  { lastName: 'aaABCc', public: false },
                  { lastName: 'aaABCc', public: true }, // this one is not matched
                  { firstName: 'aabCDef', lastName: 'aAbcdef', public: true },
                ],
                cb,
              );
            },

            // search
            function (users, cb) {
              agent
                .get('/api/users?search=aabcdef')
                .expect(200)
                .end(function (err, response) {
                  cb(err, response.body);
                });
            },

            // check that we found the users
            function (foundUsers, cb) {
              should(foundUsers).length(2);

              cb();
            },
          ],
          done,
        );
      });
    });

    context('invalid request', function () {
      it('[query string is less than 3 characters long] respond with 400', function (done) {
        agent
          .get('/api/users?search=aa')
          .expect(400)
          .end(function (err, res) {
            should(res.body.message).eql('Bad request.');
            should(res.body.detail).eql(
              'Query string should be at least 3 characters long.',
            );
            done(err);
          });
      });
    });
  });
});
