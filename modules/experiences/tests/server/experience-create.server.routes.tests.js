const should = require('should');
const request = require('supertest');
const path = require('path');
const sinon = require('sinon');
const mongoose = require('mongoose');
const faker = require('faker');
const Experience = mongoose.model('Experience');
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const express = require(path.resolve('./config/lib/express'));
const config = require(path.resolve('./config/config'));

describe('Create an experience', () => {
  // user can leave an experience to anyone
  //  - types of interaction
  //  - recommend
  //  - from whom
  //  - to whom
  // POST /experiences
  // experience can't be modified or removed
  // email notification will be sent to the receiver of the experience
  // the receiver has some time to give an experience, too.
  // after this time the only accepted answers are yes/ignore.
  // after the given time or after both left experience, both experiences become public

  // we'll catch email and push notifications
  const jobs = testutils.catchJobs();

  let user1;
  let user2;
  let user3Nonpublic;

  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _usersPublic = utils.generateUsers(2, { public: true });
  const _usersNonpublic = utils.generateUsers(1, {
    public: false,
    username: 'nonpublic',
    email: 'nonpublic@example.com',
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
      context('every experience', () => {
        it('respond with 201 Created and the new experience in body', async () => {
          const feedbackPublic = 'they were very nice and good at cooking';
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
              feedbackPublic,
            })
            .expect(201);

          should(body).match({
            public: false,
            userFrom: user1._id.toString(),
            userTo: user2._id.toString(),
            created: new Date().toISOString(),
            interactions: {
              met: true,
              guest: true,
              host: true,
            },
            feedbackPublic,
            recommend: 'yes',
            response: null,
            _id: /^[0-9a-f]{24}$/,
          });
        });

        it('save experience to database', async () => {
          // before, experience shouldn't be found in the database
          const beforeExperiences = await Experience.find({
            userFrom: user1._id,
            userTo: user2._id,
          }).exec();
          should(beforeExperiences).have.length(0);

          // send request
          await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          // after, experience should be found in the database
          const afterExperiences = await Experience.find({
            userFrom: user1._id,
            userTo: user2._id,
          }).exec();
          should(afterExperiences).have.length(1);
          should(afterExperiences[0]).match({
            userFrom: user1._id,
            userTo: user2._id,
            interactions: {
              met: true,
              guest: true,
              host: true,
            },
          });
        });

        it('[duplicate experience (the same (from, to) combination)] 409 Conflict', async () => {
          // send the first request and expect 201 Created
          await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          // send the second request and expect 409 Conflict
          await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: false,
                guest: true,
                host: false,
              },
              recommend: 'no',
            })
            .expect(409);
        });

        it('[creating an experience for self] 400', async () => {
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: user1._id, // the same user as logged in user
              interactions: {
                met: false,
                guest: true,
                host: false,
              },
              recommend: 'no',
            })
            .expect(400);

          should(body).match({
            message: 'Bad request.',
            details: {
              userTo: 'self',
            },
          });
        });

        it('[creating an experience for nonexistent user] 404', async () => {
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: '0'.repeat(24), // nonexistent user id
              interactions: {
                met: false,
                guest: true,
                host: false,
              },
              recommend: 'no',
            })
            .expect(404);

          should(body).match({
            message: 'Not found.',
            details: {
              userTo: 'not found',
            },
          });
        });

        it('[creating an experience for non-public user] 404', async () => {
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: user3Nonpublic._id, // non-public user id
              interactions: {
                met: false,
                guest: true,
                host: false,
              },
              recommend: 'no',
            })
            .expect(404);

          should(body).match({
            message: 'Not found.',
            details: {
              userTo: 'not found',
            },
          });
        });
      });

      context('initial experience', () => {
        it('the experience is saved as private', async () => {
          // send request
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          should(body).have.property('public', false);

          // after, experience should be found in the database
          const experience = await Experience.findOne({
            userFrom: user1._id,
            userTo: user2._id,
          }).exec();
          should(experience).have.property('public', false);
        });

        it('send email notification to target user', async () => {
          should(jobs.length).equal(0);

          await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          const emailJobs = jobs.filter(job => job.type === 'send email');
          should(emailJobs.length).equal(1);

          const [job] = emailJobs;
          should(job.data.subject).equal(
            `${user1.displayName} shared their experience with you`,
          );
          should(job.data.to.address).equal(user2.email);
          should(job.data.text).containEql(
            `/profile/${user1.username}/experiences/new`,
          );
          should(job.data.html).containEql(
            `/profile/${user1.username}/experiences/new`,
          );
          should(job.data.text).containEql(
            `${config.limits.timeToReplyExperience.days} days`,
          );
          should(job.data.html).containEql(
            `${config.limits.timeToReplyExperience.days} days`,
          );
        });

        it('push notification', async () => {
          await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          const pushJobs = jobs.filter(job => job.type === 'send push message');
          should(pushJobs.length).equal(1);

          const [job] = pushJobs;
          should(job.data.userId).equal(user2._id.toString());
          should(job.data.notification.title).equal('Trustroots');
          should(job.data.notification.body).equal(
            `${user1.displayName} shared their experience with you. Share your experience, too.`,
          );

          should(job.data.notification.click_action).containEql(
            `/profile/${user1.username}/experiences/new`,
          );
        });
      });

      context('reply experience', () => {
        it('set both experiences as public', async () => {
          // first create a non-public experience in the opposite direction
          const experience = new Experience({
            userFrom: user2._id,
            userTo: user1._id,
            met: true,
            recommend: 'no',
            public: false,
          });

          await experience.save();

          // create the opposite direction experience
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          should(body).have.property('public', true);

          // after, both experiences should be found in the database and public
          const experience2To1 = await Experience.findOne({
            userFrom: user2._id,
            userTo: user1._id,
          }).exec();
          should(experience2To1).have.property('public', true);

          const experience1To2 = await Experience.findOne({
            userFrom: user1._id,
            userTo: user2._id,
          }).exec();
          should(experience1To2).have.property('public', true);
        });

        it('only positive recommendation is allowed when opposite-direction public experience exists', async () => {
          // first create a public experience in the opposite direction
          const experience = new Experience({
            userFrom: user2._id,
            userTo: user1._id,
            met: true,
            recommend: 'no',
            public: true,
          });

          await experience.save();

          // create a response experience with recommend: 'no'
          // should fail
          const { body } = await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'no',
            })
            .expect(400);

          should(body).match({
            message: 'Bad request.',
            details: {
              recommend: "'yes' expected - response to public",
            },
          });

          // create a response experience with recommend: 'yes'
          // should succeed
          await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);
        });

        it('send email notification about the received experience', async () => {
          should(jobs.length).equal(0);

          // First, create an experience in the opposite direction
          const experience = new Experience({
            userFrom: user2._id,
            userTo: user1._id,
            met: true,
            recommend: 'no',
          });
          await experience.save();

          // Then respond to that experience
          const { body: experienceResponse } = await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          const emailJobs = jobs.filter(job => job.type === 'send email');
          should(emailJobs.length).equal(1);

          const [job] = emailJobs;
          should(job.data.subject).equal(
            `${user1.displayName} shared also their experience with you`,
          );

          should(job.data.to.address).equal(user2.email);
          should(job.data.text).containEql(
            `/profile/${user2.username}/experiences#${experienceResponse._id}`,
          );
          should(job.data.html).containEql(
            `/profile/${user2.username}/experiences?utm_source=transactional-email&amp;utm_medium=email&amp;utm_campaign=experience-notification-second&amp;utm_content=see-experiences#${experienceResponse._id}`,
          );
        });

        it('push notification', async () => {
          should(jobs.length).equal(0);

          // First, create an experience in the opposite direction
          const experience = new Experience({
            userFrom: user2._id,
            userTo: user1._id,
            interaction: {
              met: true,
            },
            recommend: 'no',
          });
          await experience.save();

          // Then respond to that experience
          const { body: experienceResponse } = await agent
            .post('/api/experiences')
            .send({
              userTo: user2._id,
              interactions: {
                met: true,
                guest: true,
                host: true,
              },
              recommend: 'yes',
            })
            .expect(201);

          const pushJobs = jobs.filter(job => job.type === 'send push message');
          should(pushJobs.length).equal(1);

          const [job] = pushJobs;
          should(job.data.userId).equal(user2._id.toString());
          should(job.data.notification.title).equal('Trustroots');
          should(job.data.notification.body).equal(
            `${user1.displayName} shared their experience with you. Both experiences are now published.`,
          );

          should(job.data.notification.click_action).containEql(
            `/profile/${user2.username}/experiences?utm_source=push-notification&utm_medium=fcm&utm_campaign=new-experience&utm_content=read#${experienceResponse._id}`,
          );
        });
      });
    });

    context('invalid request', () => {
      it('[invalid value in interaction types] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            userTo: user2._id,
            interactions: {
              met: 'met',
              guest: false,
            },
            recommend: 'unknown',
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            interactions: {
              met: 'boolean expected',
            },
          },
        });
      });

      it('[invalid recommendation] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            userTo: user2._id,
            interactions: {
              met: true,
              guest: false,
            },
            recommend: 'invalid',
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            recommend: "one of 'yes', 'no', 'unknown' expected",
          },
        });
      });

      it('[invalid userTo] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            userTo: 'hello',
            interactions: {
              guest: true,
            },
            recommend: 'yes',
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            userTo: 'userId expected',
          },
        });
      });

      it('[missing userTo] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            interactions: {
              guest: true,
            },
            recommend: 'yes',
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            userTo: 'missing',
          },
        });
      });

      it('[unexpected fields] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            userTo: user2._id,
            interactions: {
              guest: true,
            },
            recommend: 'yes',
            foo: 'bar',
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            fields: 'unexpected',
          },
        });
      });

      it('[too long public feedback] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            userTo: user2._id,
            met: false,
            interactions: {
              guest: true,
            },
            recommend: 'yes',
            feedbackPublic: faker.lorem.words(2000), // probably longer than the limit
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            feedbackPublic: 'toolong',
          },
        });
      });

      it('[all interaction types false or missing] 400', async () => {
        const { body } = await agent
          .post('/api/experiences')
          .send({
            userTo: user2._id,
            met: false,
            interactions: {
              guest: false,
            },
            recommend: 'yes',
          })
          .expect(400);

        should(body).match({
          message: 'Bad request.',
          details: {
            interactions: {
              any: 'missing',
            },
          },
        });
      });
    });
  });

  context('logged in as non-public user', () => {
    // Sign in and sign out
    beforeEach(utils.signIn.bind(this, _usersNonpublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent.post('/api/experiences').send({}).expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent.post('/api/experiences').send({}).expect(403);
    });
  });
});
