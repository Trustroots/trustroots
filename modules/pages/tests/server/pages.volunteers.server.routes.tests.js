const request = require('supertest');
const mongoose = require('mongoose');
const should = require('should');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');

describe('Volunteers page route tests', function () {
  let app;
  let agent;

  before(function () {
    app = express.init(mongoose.connection);
    agent = request.agent(app);
  });

  afterEach(utils.clearDatabase);

  function createUser(username, roles, done) {
    const user = new User({
      public: true,
      firstName: username,
      lastName: 'Tester',
      displayName: username + ' Tester',
      email: username + '@example.com',
      username,
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      roles,
    });

    user.save(done);
  }

  it('should group users by volunteer and volunteer-alumni roles', function (done) {
    createUser('activevolunteer', ['user', 'volunteer'], function (err1) {
      if (err1) {
        return done(err1);
      }
      createUser('oldvolunteer', ['user', 'volunteer-alumni'], function (err2) {
        if (err2) {
          return done(err2);
        }
        createUser('regularuser', ['user'], function (err3) {
          if (err3) {
            return done(err3);
          }

          agent
            .get('/api/volunteers')
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }

              res.body.volunteers.length.should.equal(1);
              res.body.alumni.length.should.equal(1);

              res.body.volunteers[0].username.should.equal('activevolunteer');
              res.body.volunteers[0].firstName.should.equal('activevolunteer');
              should.exist(res.body.volunteers[0]._id);
              // Only whitelisted fields are returned
              should.not.exist(res.body.volunteers[0].email);

              res.body.alumni[0].username.should.equal('oldvolunteer');

              return done();
            });
        });
      });
    });
  });

  it('should return empty arrays when there are no volunteers', function (done) {
    createUser('regularuser', ['user'], function (createErr) {
      if (createErr) {
        return done(createErr);
      }

      agent
        .get('/api/volunteers')
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          res.body.volunteers.should.be.an.Array();
          res.body.volunteers.length.should.equal(0);
          res.body.alumni.length.should.equal(0);

          return done();
        });
    });
  });
});
