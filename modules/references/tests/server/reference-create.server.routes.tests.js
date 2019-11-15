const should = require('should'),
      request = require('supertest'),
      path = require('path'),
      sinon = require('sinon'),
      mongoose = require('mongoose'),
      Reference = mongoose.model('Reference'),
      testutils = require(path.resolve('./testutils/server.testutil')),
      utils = require(path.resolve('./testutils/data.server.testutils')),
      express = require(path.resolve('./config/lib/express'));

describe('Create a reference', () => {

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
  const jobs = testutils.catchJobs();

  let user1,
      user2,
      user3Nonpublic;

  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _usersPublic = utils.generateUsers(2, { public: true });
  const _usersNonpublic = utils.generateUsers(1, {
    public: false,
    username: 'nonpublic',
    email: 'nonpublic@example.com'
  });

  const _users = [..._usersPublic, ..._usersNonpublic];

  beforeEach(() => {
    sinon.useFakeTimers({ now: 1500000000000, toFake: ['Date'] });
  });

  afterEach(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    [user1, user2, user3Nonpublic] = await utils.saveUsers(_users);
  });

  afterEach(utils.clearDatabase);

  context('logged in', () => {
    // Sign in and sign out
    beforeEach(utils.signIn.bind(this, _users[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    context('valid request', () => {
      context('every reference', () => {

        it('respond with 201 Created and the new reference in body', async () => {
          const { body } = await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          should(body).match({
            public: false,
            userFrom: user1._id.toString(),
            userTo: user2._id.toString(),
            created: new Date().toISOString(),
            interactions: {
              met: true,
              hostedMe: true,
              hostedThem: true
            },
            recommend: 'yes',
            _id: /^[0-9a-f]{24}$/
          });
        });

        it('save reference to database', async () => {
          // before, reference shouldn't be found in the database
          const beforeReferences = await Reference.find({ userFrom: user1._id, userTo: user2._id }).exec();
          should(beforeReferences).have.length(0);

          // send request
          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          // after, reference should be found in the database
          const afterReferences = await Reference.find({ userFrom: user1._id, userTo: user2._id }).exec();
          should(afterReferences).have.length(1);
          should(afterReferences[0]).match({
            userFrom: user1._id,
            userTo: user2._id,
            interactions: {
              met: true,
              hostedMe: true,
              hostedThem: true
            }
          });
        });


        it('[duplicate reference (the same (from, to) combination)] 409 Conflict', async () => {
          // send the first request and expect 201 Created
          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          // send the second request and expect 409 Conflict
          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(409);
        });

        it('[creating a reference for self] 400', async () => {
          const { body } = await agent.post('/api/references')
            .send({
              userTo: user1._id, // the same user as logged in user
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(400);

          should(body).match({
            message: 'Bad request.',
            details: {
              userTo: 'self'
            }
          });
        });

        it('[creating a reference for nonexistent user] 404', async () => {
          const { body } = await agent.post('/api/references')
            .send({
              userTo: '0'.repeat(24), // nonexistent user id
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(404);

          should(body).match({
            message: 'Not found.',
            details: {
              userTo: 'not found'
            }
          });
        });

        it('[creating a reference for non-public user] 404', async () => {
          const { body } = await agent.post('/api/references')
            .send({
              userTo: user3Nonpublic._id, // non-public user id
              interactions: {
                met: false,
                hostedMe: true,
                hostedThem: false
              },
              recommend: 'no'
            })
            .expect(404);

          should(body).match({
            message: 'Not found.',
            details: {
              userTo: 'not found'
            }
          });
        });
      });

      context('initial reference', () => {
        it('the reference is saved as private', async () => {
          // send request
          const { body } = await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          should(body).have.property('public', false);

          // after, reference should be found in the database
          const reference = await Reference.findOne({ userFrom: user1._id, userTo: user2._id }).exec();
          should(reference).have.property('public', false);
        });

        it('send email notification to target user', async () => {
          should(jobs.length).equal(0);

          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          const emailJobs = jobs.filter(job => job.type === 'send email');
          should(emailJobs.length).equal(1);

          const [job] = emailJobs;
          // @TODO design the email (subject, body, ...)
          should(job.data.subject).equal(`New reference from ${user1.username}`);
          should(job.data.to.address).equal(user2.email);
          // @TODO add the right link
          should(job.data.text)
            .containEql(`/profile/${user1.username}/references/new`);
          should(job.data.html)
            .containEql(`/profile/${user1.username}/references/new`);
        });

        it('push notification', async () => {
          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          const pushJobs = jobs.filter(job => job.type === 'send push message');
          should(pushJobs.length).equal(1);

          const [job] = pushJobs;
          should(job.data.userId).equal(user2._id.toString());
          should(job.data.notification.title).equal('Trustroots');
          // @TODO design the notification text
          should(job.data.notification.body)
            .equal(`${user1.username} gave you a new reference. Give a reference back.`);
          should(job.data.notification.click_action)
            .containEql(`/profile/${user1.username}/references/new`);
        });
      });

      context('reply reference', () => {

        it('set both references as public', async () => {
          // first create a non-public reference in the opposite direction
          const reference = new Reference({
            userFrom: user2._id,
            userTo: user1._id,
            met: true,
            recommend: 'no',
            public: false
          });

          await reference.save();

          // create the opposite direction reference
          const { body } = await agent
            .post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          should(body).have.property('public', true);

          // after, both references should be found in the database and public
          const reference2To1 = await Reference.findOne({ userFrom: user2._id, userTo: user1._id }).exec();
          should(reference2To1).have.property('public', true);

          const reference1To2 = await Reference.findOne({ userFrom: user1._id, userTo: user2._id }).exec();
          should(reference1To2).have.property('public', true);
        });

        it('only positive recommendation is allowed when opposite-direction public reference exists', async () => {
          // first create a public reference in the opposite direction
          const reference = new Reference({
            userFrom: user2._id,
            userTo: user1._id,
            met: true,
            recommend: 'no',
            public: true
          });

          await reference.save();

          // create a response reference with recommend: 'no'
          // should fail
          const { body } = await agent
            .post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'no'
            })
            .expect(400);

          should(body).match({
            message: 'Bad request.',
            details: {
              recommend: '\'yes\' expected - response to public'
            }
          });

          // create a response reference with recommend: 'yes'
          // should succeed
          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);
        });

        it('send email notification about the received reference', async () => {
          should(jobs.length).equal(0);

          // first create a reference in the opposite direction
          const reference = new Reference({
            userFrom: user2._id,
            userTo: user1._id,
            met: true,
            recommend: 'no'
          });

          await reference.save();

          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          const emailJobs = jobs.filter(job => job.type === 'send email');
          should(emailJobs.length).equal(1);

          const [job] = emailJobs;
          // @TODO design the email (subject, body, ...)
          should(job.data.subject).equal(`New reference from ${user1.username}`);
          should(job.data.to.address).equal(user2.email);
          // @TODO add the right link
          // this is a link to the own references - see my references
          // because I already gave a reference
          should(job.data.text)
            .containEql(`/profile/${user2.username}/references`);
          should(job.data.html)
            .containEql(`/profile/${user2.username}/references`);
        });

        it('push notification', async () => {
          should(jobs.length).equal(0);

          // first create a reference in the opposite direction
          const reference = new Reference({
            userFrom: user2._id,
            userTo: user1._id,
            interaction: {
              met: true
            },
            recommend: 'no'
          });

          await reference.save();

          await agent.post('/api/references')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                hostedMe: true,
                hostedThem: true
              },
              recommend: 'yes'
            })
            .expect(201);

          const pushJobs = jobs.filter(job => job.type === 'send push message');
          should(pushJobs.length).equal(1);

          const [job] = pushJobs;
          should(job.data.userId).equal(user2._id.toString());
          should(job.data.notification.title).equal('Trustroots');
          // @TODO design the notification text
          should(job.data.notification.body)
            .equal(`${user1.username} gave you a new reference. You can see it.`);
          should(job.data.notification.click_action)
            .containEql(`/profile/${user2.username}/references`);
        });
      });
    });

    context('invalid request', () => {
      it('[invalid value in interaction types] 400', async () => {
        const { body } = await agent.post('/api/references')
          .send({
            userTo: user2._id,
            interactions: {
              met: 'met',
              hostedMe: false
            },
            recommend: 'unknown'
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            interactions: {
              met: 'boolean expected'
            }
          }
        });
      });

      it('[invalid recommendation] 400', async () => {
        const { body } = await agent.post('/api/references')
          .send({
            userTo: user2._id,
            interactions: {
              met: true,
              hostedMe: false
            },
            recommend: 'invalid'
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            recommend: 'one of \'yes\', \'no\', \'unknown\' expected'
          }
        });
      });

      it('[invalid userTo] 400', async () => {
        const { body } = await agent.post('/api/references')
          .send({
            userTo: 'hello',
            interactions: {
              hostedMe: true
            },
            recommend: 'yes'
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            userTo: 'userId expected'
          }
        });
      });

      it('[missing userTo] 400', async () => {
        const { body } = await agent.post('/api/references')
          .send({
            interactions: {
              hostedMe: true
            },
            recommend: 'yes'
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            userTo: 'missing'
          }
        });
      });

      it('[unexpected fields] 400', async () => {
        const { body } = await agent.post('/api/references')
          .send({
            userTo: user2._id,
            interactions: {
              hostedMe: true
            },
            recommend: 'yes',
            foo: 'bar'
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            fields: 'unexpected'
          }
        });
      });

      it('[all interaction types false or missing] 400', async () => {
        const { body } = await agent.post('/api/references')
          .send({
            userTo: user2._id,
            met: false,
            interactions: {
              hostedMe: false
            },
            recommend: 'yes'
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            interactions: {
              any: 'missing'
            }
          }
        });
      });
    });
  });

  context('logged in as non-public user', () => {
    // Sign in and sign out
    beforeEach(utils.signIn.bind(this, _usersNonpublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent.post('/api/references')
        .send({ })
        .expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent.post('/api/references')
        .send({ })
        .expect(403);
    });
  });
});
