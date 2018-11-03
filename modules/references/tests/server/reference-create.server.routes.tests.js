'use strict';

var should = require('should'),
    request = require('supertest'),
    async = require('async'),
    path = require('path'),
    sinon = require('sinon'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Reference = mongoose.model('Reference'),
    testutils = require(path.resolve('./testutils/server.testutil')),
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

  // we'll catch email and push notifications
  var jobs = testutils.catchJobs();

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

    async.eachSeries([user1, user2, user3Nonpublic], function (user, cb) {
      user.save(cb);
    }, done);
  });

  afterEach(function (done) {
    Reference.deleteMany().exec(function () {
      User.deleteMany().exec(done);
    });
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
        .end(function (err) {
          return done(err);
        });
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
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
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
                interactions: {
                  met: true,
                  hostedMe: true,
                  hostedThem: true
                },
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
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
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
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  }
                });
                cb();
              } catch (e) {
                cb(e);
              }
            }
          ], done);
        });


        it('[duplicate reference (the same (from, to) combination)] 409 Conflict', function (done) {
          async.waterfall([
            // send the first request and expect 201 Created
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err) {
                  cb(err);
                });
            },
            // send the second request and expect 409 Conflict
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: false,
                    hostedMe: true,
                    hostedThem: false
                  },
                  recommend: 'no'
                })
                .expect(409)
                .end(function (err) {
                  cb(err);
                });
            }
          ], done);
        });

        it('[creating a reference for self] 400', function (done) {
          agent.post('/api/references')
            .send({
              userTo: user1._id, // the same user as logged in user
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(400)
            .end(function (err, response) {
              if (err) return done(err);

              try {
                should(response.body).match({
                  message: 'Bad request.',
                  details: {
                    userTo: 'self'
                  }
                });
                return done();
              } catch (e) {
                return done(e);
              }
            });
        });

        it('[creating a reference for nonexistent user] 404', function (done) {
          agent.post('/api/references')
            .send({
              userTo: '0'.repeat(24), // nonexistent user id
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(404)
            .end(function (err, response) {
              if (err) return done(err);

              try {
                should(response.body).match({
                  message: 'Not found.',
                  detail: 'User not found.'
                });
                return done();
              } catch (e) {
                return done(e);
              }
            });
        });

        it('[creating a reference for non-public user] 404', function (done) {
          agent.post('/api/references')
            .send({
              userTo: user3Nonpublic._id, // non-public user id
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(404)
            .end(function (err, response) {
              if (err) return done(err);

              try {
                should(response.body).match({
                  message: 'Not found.',
                  detail: 'User not found.'
                });
                return done();
              } catch (e) {
                return done(e);
              }
            });
        });
      });

      context('initial reference', function () {
        it('the reference is saved as private', function (done) {
          async.waterfall([
            // send request
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err, response) {
                  if (err) return cb(err);

                  try {
                    should(response).have.propertyByPath('body', 'public').equal(false);
                    return cb();
                  } catch (e) {
                    return cb(e);
                  }
                });
            },
            // after, reference should be found in the database
            function (cb) {
              Reference.findOne({ userFrom: user1._id, userTo: user2._id }).exec(function (err, reference) {
                if (err) return cb(err);

                try {
                  should(reference).have.property('public', false);
                  return cb();
                } catch (e) {
                  return cb(e);
                }
              });
            }
          ], done);
        });

        it('send email notification to target user', function (done) {
          try {
            should(jobs.length).equal(0);
          } catch (e) {
            return done(e);
          }

          agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201)
            .end(function (err) {
              if (err) return done(err);

              try {
                var emailJobs = jobs.filter(function (job) { return job.type === 'send email'; });
                should(emailJobs.length).equal(1);

                var job = emailJobs[0];
                // @TODO design the email (subject, body, ...)
                should(job.data.subject).equal('New reference from ' + user1.username);
                should(job.data.to.address).equal(user2.email);
                // @TODO add the right link
                should(job.data.text)
                  .containEql('/profile/' + user1.username + '/references/new');
                should(job.data.html)
                  .containEql('/profile/' + user1.username + '/references/new');

                return done();
              } catch (e) {
                return done(e);
              }
            });
        });

        it('push notification', function (done) {
          agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201)
            .end(function (err) {
              if (err) return done(err);

              try {
                var pushJobs = jobs.filter(function (job) { return job.type === 'send push message'; });
                should(pushJobs.length).equal(1);

                var job = pushJobs[0];
                should(job.data.userId).equal(user2._id.toString());
                should(job.data.notification.title).equal('Trustroots');
                // @TODO design the notification text
                should(job.data.notification.body)
                  .equal(user1.username + ' gave you a new reference. Give a reference back.');
                should(job.data.notification.click_action)
                  .containEql('/profile/' + user1.username + '/references/new');

                return done();
              } catch (e) {
                return done(e);
              }
            });
        });
      });

      context('reply reference', function () {

        it('set both references as public', function (done) {
          async.waterfall([
            // first create a non-public reference in the opposite direction
            function (cb) {
              var reference = new Reference({
                userFrom: user2._id,
                userTo: user1._id,
                met: true,
                recommend: 'no',
                public: false
              });

              return reference.save(function (err) {
                return cb(err);
              });
            },
            // create the opposite direction reference
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err, response) {
                  if (err) return cb(err);

                  try {
                    should(response).have.propertyByPath('body', 'public').equal(true);
                    return cb();
                  } catch (e) {
                    return cb(e);
                  }
                });
            },
            // after, both references should be found in the database and public
            function (cb) {
              Reference.findOne({ userFrom: user2._id, userTo: user1._id }).exec(function (err, reference) {
                if (err) return cb(err);

                try {
                  should(reference).have.property('public', true);
                  return cb();
                } catch (e) {
                  return cb(e);
                }
              });
            },
            function (cb) {
              Reference.findOne({ userFrom: user1._id, userTo: user2._id }).exec(function (err, reference) {
                if (err) return cb(err);

                try {
                  should(reference).have.property('public', true);
                  return cb();
                } catch (e) {
                  return cb(e);
                }
              });
            }
          ], done);
        });

        it('only positive recommendation is allowed when opposite-direction public reference exists', function (done) {
          async.waterfall([
            // first create a public reference in the opposite direction
            function (cb) {
              var reference = new Reference({
                userFrom: user2._id,
                userTo: user1._id,
                met: true,
                recommend: 'no',
                public: true
              });

              return reference.save(function (err) {
                return cb(err);
              });
            },
            // create a response reference with recommend: 'no'
            // should fail
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'no'
                })
                .expect(400)
                .end(function (err, response) {
                  if (err) return cb(err);

                  try {
                    should(response).have.propertyByPath('body').match({
                      message: 'Bad request.',
                      details: ['Only a positive recommendation is allowed in response to a public reference.']
                    });
                    return cb();
                  } catch (e) {
                    return cb(e);
                  }
                });
            },
            // create a response reference with recommend: 'yes'
            // should succeed
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err) {
                  return cb(err);
                });
            }
          ], done);
        });

        it('send email notification about the received reference', function (done) {
          try {
            should(jobs.length).equal(0);
          } catch (e) {
            return done(e);
          }

          async.waterfall([
            // first create a reference in the opposite direction
            function (cb) {
              var reference = new Reference({
                userFrom: user2._id,
                userTo: user1._id,
                met: true,
                recommend: 'no'
              });

              return reference.save(function (err) {
                return cb(err);
              });
            },
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err) {
                  if (err) return cb(err);

                  try {
                    var emailJobs = jobs.filter(function (job) { return job.type === 'send email'; });
                    should(emailJobs.length).equal(1);

                    var job = emailJobs[0];
                    // @TODO design the email (subject, body, ...)
                    should(job.data.subject).equal('New reference from ' + user1.username);
                    should(job.data.to.address).equal(user2.email);
                    // @TODO add the right link
                    // this is a link to the own references - see my references
                    // because I already gave a reference
                    should(job.data.text)
                      .containEql('/profile/' + user2.username + '/references');
                    should(job.data.html)
                      .containEql('/profile/' + user2.username + '/references');

                    return cb();
                  } catch (e) {
                    return cb(e);
                  }
                });
            }
          ], done);

        });

        it('push notification', function (done) {
          try {
            should(jobs.length).equal(0);
          } catch (e) {
            return done(e);
          }

          async.waterfall([
            // first create a reference in the opposite direction
            function (cb) {
              var reference = new Reference({
                userFrom: user2._id,
                userTo: user1._id,
                interaction: {
                  met: true
                },
                recommend: 'no'
              });

              return reference.save(function (err) {
                return cb(err);
              });
            },
            function (cb) {
              agent.post('/api/references')
                .send({
                  userTo: user2._id,
                  interactions: {
                    met: true,
                    hostedMe: true,
                    hostedThem: true
                  },
                  recommend: 'yes'
                })
                .expect(201)
                .end(function (err) {
                  if (err) return cb(err);

                  try {
                    var pushJobs = jobs.filter(function (job) { return job.type === 'send push message'; });
                    should(pushJobs.length).equal(1);

                    var job = pushJobs[0];
                    should(job.data.userId).equal(user2._id.toString());
                    should(job.data.notification.title).equal('Trustroots');
                    // @TODO design the notification text
                    should(job.data.notification.body)
                      .equal(user1.username + ' gave you a new reference. You can see it.');
                    should(job.data.notification.click_action)
                      .containEql('/profile/' + user2.username + '/references');

                    return cb();
                  } catch (e) {
                    return cb(e);
                  }
                });
            }
          ], done);

        });
      });
    });

    context('invalid request', function () {
      it('[invalid value in interaction types] 400', function (done) {
        agent.post('/api/references')
          .send({
            userTo: user2._id,
            interactions: {
              met: 'met',
              hostedMe: false
            },
            recommend: 'unknown'
          })
          .expect(400)
          .end(function (err, response) {
            if (err) return done(err);

            try {
              should(response.body).match({
                message: 'Bad request.',
                details: {
                  interactions: {
                    met: 'boolean expected'
                  }
                }
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });

      it('[invalid recommendation] 400', function (done) {
        agent.post('/api/references')
          .send({
            userTo: user2._id,
            interactions: {
              met: true,
              hostedMe: false
            },
            recommend: 'invalid'
          })
          .expect(400)
          .end(function (err, response) {
            if (err) return done(err);

            try {
              should(response.body).match({
                message: 'Bad request.',
                details: {
                  recommend: 'one of \'yes\', \'no\', \'unknown\' expected'
                }
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });

      it('[invalid userTo] 400', function (done) {
        agent.post('/api/references')
          .send({
            userTo: 'hello',
            interactions: {
              hostedMe: true
            },
            recommend: 'yes'
          })
          .expect(400)
          .end(function (err, response) {
            if (err) return done(err);

            try {
              should(response.body).match({
                message: 'Bad request.',
                details: {
                  userTo: 'userId expected'
                }
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });

      it('[missing userTo] 400', function (done) {
        agent.post('/api/references')
          .send({
            interactions: {
              hostedMe: true
            },
            recommend: 'yes'
          })
          .expect(400)
          .end(function (err, response) {
            if (err) return done(err);

            try {
              should(response.body).match({
                message: 'Bad request.',
                details: {
                  userTo: 'missing'
                }
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });

      it('[unexpected fields] 400', function (done) {
        agent.post('/api/references')
          .send({
            userTo: user2._id,
            interactions: {
              hostedMe: true
            },
            recommend: 'yes',
            foo: 'bar'
          })
          .expect(400)
          .end(function (err, response) {
            if (err) return done(err);

            try {
              should(response.body).match({
                message: 'Bad request.',
                details: {
                  fields: 'unexpected'
                }
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });

      it('[all interaction types false or missing] 400', function (done) {
        agent.post('/api/references')
          .send({
            userTo: user2._id,
            met: false,
            interactions: {
              hostedMe: false
            },
            recommend: 'yes'
          })
          .expect(400)
          .end(function (err, response) {
            if (err) return done(err);

            try {
              should(response.body).match({
                message: 'Bad request.',
                details: {
                  interactions: {
                    any: 'missing'
                  }
                }
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });
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
