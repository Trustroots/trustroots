'use strict';

var should = require('should'),
    request = require('supertest'),
    async = require('async'),
    path = require('path'),
    sinon = require('sinon'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Reference = mongoose.model('Reference'),
    express = require(path.resolve('./config/lib/express'));

describe('Create a reference', function () {

  // user can leave a reference to anyone
  //  - types of interaction
  //  - recommend
  //  - from whom
  //  - to whom
  // POST /references
  // reference can't be modified or removed
  // email notification will be sent to the receiver of the reference
  // the receiver has some time to give a reference, too.
  // after this time the only accepted answers are yes/ignore.
  // after the given time or after both left reference, both references become public

  var user1,
      user2,
      user3Nonpublic;

  var app = express.init(mongoose.connection);
  var agent = request.agent(app);

  var _user1 = {
    public: true,
    firstName: 'Full',
    lastName: 'Name',
    displayName: 'Full Name',
    email: 'user1@example.com',
    username: 'user1',
    displayUsername: 'user1',
    password: 'correcthorsebatterystaples',
    provider: 'local'
  };

  var _user2 = {
    public: true,
    firstName: 'Full2',
    lastName: 'Name2',
    displayName: 'Full2 Name2',
    email: 'user2@example.com',
    username: 'user2',
    displayUsername: 'user2',
    password: 'correcthorsebatterystaples',
    provider: 'local'
  };

  var _user3Nonpublic = {
    public: false,
    firstName: 'Full3',
    lastName: 'Name3',
    displayName: 'Full3 Name3',
    email: 'user3@example.com',
    username: 'user3',
    displayUsername: 'user3',
    password: 'correcthorsebatterystaples',
    provider: 'local'
  };

  beforeEach(function () {
    sinon.useFakeTimers({ now: 1500000000000, toFake: ['Date'] });
  });

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function (done) {

    user1 = new User(_user1);
    user2 = new User(_user2);
    user3Nonpublic = new User(_user3Nonpublic);

    user1.save(function (err) {
      if (err) return done(err);
      return user2.save(function (err) {
        if (err) return done(err);
        return user3Nonpublic.save(done);
      });
    });
  });

  afterEach(function (done) {
    User.remove().exec(done);
  });

  /**
   * @TODO this can be refactored. Sign in may be moved to some test utils
   *
   *
   */
  function signIn(credentials, agent) {
    return function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(done);
    };
  }

  /**
   *
   *
   */
  function signOut(agent) {
    return function (done) {
      agent.get('/api/auth/signout')
        .expect(302)
        .end(done);
    };
  }

  context('logged in', function () {
    // Sign in and sign out
    beforeEach(signIn({ username: _user1.username, password: _user1.password }, agent));
    afterEach(signOut(agent));

    context('valid request', function () {
      context('every reference', function () {

        it('respond with 201 Created and the new reference in body', function (done) {
          agent.post('/api/references')
            .send({
              userTo: user2._id,
              met: true,
              hostedMe: true,
              hostedThem: true,
              recommend: 'yes'
            })
            .expect(201)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }

              should(res.body).match({
                public: false,
                userFrom: user1._id.toString(),
                userTo: user2._id.toString(),
                created: Date.now(),
                met: true,
                hostedMe: true,
                hostedThem: true,
                recommend: 'yes'
              });

              should(res.body).have.property('id').match(/^[0-9a-f]{24}$/);

              return done();
            });
        });

        it('save reference to database', function (done) {
          async.waterfall([
            // before, reference shouldn't be found in the database
            function (cb) {
              Reference.find({ userFrom: user1._id, userTo: user2._id }).exec(cb);
            },
            function (references, cb) {
              try {
                should(references).have.length(0);
                cb();
              } catch (e) {
                cb(e);
              }
            },
            // send request
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  met: true,
                  hostedMe: true,
                  hostedThem: true,
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err) {
                  cb(err);
                });
            },
            // after, reference should be found in the database
            function (cb) {
              Reference.find({ userFrom: user1._id, userTo: user2._id }).exec(cb);
            },
            function (references, cb) {
              try {
                should(references).have.length(1);
                should(references[0]).match({
                  userFrom: user1._id,
                  userTo: user2._id
                });
                cb();
              } catch (e) {
                cb(e);
              }
            }
          ], done);
        });


        it('[duplicate reference between these people] 409 Conflict');
        it('[sending a reference to self] 400');
        it('[sending a reference to nonexistent user] 404');
        it('[sending a reference to non-public user]');
      });

      context('initial reference', function () {
        it('the reference is private');
        it('send email notification to target user');
      });

      context('reply reference', function () {
        it('[late] only positive recommendation is allowed');
        it('set both references as public');
        it('send email notification (maybe)');
      });
    });

    context('invalid request', function () {
      it('[invalid value in interaction types] 400');
      it('[invalid recommendation] 400');
      it('[invalid receiver id] 400');
      it('[missing fields] 400');
      it('[unexpected fields] 400');
      it('[all interaction types false] 400');
    });
  });

  context('logged in as non-public user', function () {
    // Sign in and sign out
    beforeEach(signIn({ username: _user3Nonpublic.username, password: _user3Nonpublic.password }, agent));
    afterEach(signOut(agent));

    it('403', function (done) {
      agent.post('/api/references')
        .send({

        })
        .expect(403)
        .end(function (err) {
          if (err) {
            return done(err);
          }

          return done();
        });
    });
  });

  context('not logged in', function () {
    it('403', function (done) {
      agent.post('/api/references')
        .send({

        })
        .expect(403)
        .end(function (err) {
          if (err) {
            return done(err);
          }

          return done();
        });
    });
  });
});
