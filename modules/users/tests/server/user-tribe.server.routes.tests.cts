import type { HydratedDocument } from 'mongoose';
import type {
  Credentials,
  TribeRecord,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const should: typeof import('should') = require('should');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: {
  init(
    connection: import('mongoose').Connection,
  ): Promise<import('express').Express>;
} = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord>('User');
const Tribe = mongoose.model<TribeRecord>('Tribe');
type UserDocument = HydratedDocument<UserRecord>;
type TribeDocument = HydratedDocument<TribeRecord>;
interface MembershipApiResponse {
  message: string;
  tribe: {
    _id: string;
    count: number;
    label: string;
    slug: string;
    color?: string;
  };
  user: {
    username: string;
    memberIds: string[];
    member: Array<{ tribe: string; since?: string }>;
  };
}
interface ErrorApiResponse {
  message: string;
}

function membershipResponse(
  response: import('supertest').Response,
): MembershipApiResponse {
  return response.body as MembershipApiResponse;
}
function errorResponse(
  response: import('supertest').Response,
): ErrorApiResponse {
  return response.body as ErrorApiResponse;
}

function saveTribe(
  tribe: TribeDocument,
  callback: (error: unknown | null, savedTribe: TribeDocument) => void,
): void {
  void tribe.save().then(
    savedTribe => callback(null, savedTribe),
    error => callback(error, tribe),
  );
}

/**
 * Globals
 */
let app: import('express').Express;
let agent: ReturnType<typeof request.agent>;
let credentials: Credentials;
let user: UserDocument;
let _user: UserRecord;

/**
 * User routes tests
 */
describe('User tribe memberships CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'TRusername',
      password: 'TR-I$Aw3$0m4',
    };

    // Create a new user
    _user = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      emailToken: 'initial email token',
      username: credentials.username.toLowerCase(),
      password: credentials.password,
      provider: 'local',
    };
    user = new User(_user);

    // Save a user to the test db
    void user.save().then(() => done(), done);
  });
  afterEach(utils.clearDatabase);
  it('should be able to join a tribe', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Awesome Tribe',
        });

        // Add tribe to test DB
        saveTribe(tribe, function (err, tribe) {
          should.not.exist(err);
          agent
            .post('/api/users/memberships/' + tribe._id)
            .set('X-Trustroots-Request', '1')
            .send()
            .expect(200)
            .end(function (userTribeErr, userTribeRes) {
              // Handle joining tag error
              if (userTribeErr) {
                return done(userTribeErr);
              }

              // Confirmation message
              membershipResponse(userTribeRes).message.should.be.equal(
                'Joined tribe.',
              );

              // It should return correct tribe with new count
              membershipResponse(userTribeRes).tribe._id.should.be.equal(
                tribe._id.toString(),
              );
              membershipResponse(userTribeRes).tribe.count.should.be.equal(1);
              membershipResponse(userTribeRes).tribe.label.should.be.equal(
                'Awesome Tribe',
              );
              membershipResponse(userTribeRes).tribe.slug.should.be.equal(
                'awesome-tribe',
              );
              should.exist(membershipResponse(userTribeRes).tribe.color);

              // It should return updated user
              membershipResponse(userTribeRes).user.username.should.be.equal(
                credentials.username.toLowerCase(),
              );
              membershipResponse(
                userTribeRes,
              ).user.memberIds[0].should.be.equal(tribe._id.toString());
              membershipResponse(
                userTribeRes,
              ).user.member[0].tribe.should.be.equal(tribe._id.toString());
              should.exist(
                membershipResponse(userTribeRes).user.member[0].since,
              );
              return done();
            });
        });
      });
  });
  it('should be able to leave tribes', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Hitchhikers',
        });

        // Add tribe to test DB
        saveTribe(tribe, function (err, tribe) {
          should.not.exist(err);

          // Join tribe
          agent
            .post('/api/users/memberships/' + tribe._id)
            .set('X-Trustroots-Request', '1')
            .send()
            .expect(200)
            .end(function (userTribeJoinErr, userTribeJoinRes) {
              // Handle joining tag error
              if (userTribeJoinErr) {
                return done(userTribeJoinErr);
              }

              // Count +1
              membershipResponse(userTribeJoinRes).tribe.count.should.be.equal(
                1,
              );

              // User is now member of tribe
              membershipResponse(
                userTribeJoinRes,
              ).user.memberIds.length.should.be.equal(1);
              membershipResponse(
                userTribeJoinRes,
              ).user.member.length.should.be.equal(1);

              // Leave tribe
              agent
                .delete('/api/users/memberships/' + tribe._id)
                .set('X-Trustroots-Request', '1')
                .send()
                .expect(200)
                .end(function (userTagLeaveErr, userTagLeaveRes) {
                  // Handle leaving tag error
                  if (userTagLeaveErr) {
                    return done(userTagLeaveErr);
                  }

                  // Count -1
                  membershipResponse(
                    userTagLeaveRes,
                  ).tribe.count.should.be.equal(0);

                  // No more tribes left on user's array
                  membershipResponse(
                    userTagLeaveRes,
                  ).user.memberIds.length.should.be.equal(0);
                  membershipResponse(
                    userTagLeaveRes,
                  ).user.member.length.should.be.equal(0);
                  return done();
                });
            });
        });
      });
  });
  it('should be able to show error if trying to join same tribe twice', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Russian literature students',
        });

        // Add tribe to test DB
        saveTribe(tribe, function (err, tribe) {
          should.not.exist(err);

          // Join tribe
          agent
            .post('/api/users/memberships/' + tribe._id)
            .set('X-Trustroots-Request', '1')
            .send()
            .expect(200)
            .end(function (userTribeJoinErr, userTribeJoinRes) {
              // Handle joining tag error
              if (userTribeJoinErr) {
                return done(userTribeJoinErr);
              }

              // Count +1
              membershipResponse(userTribeJoinRes).tribe.count.should.be.equal(
                1,
              );

              // User is now member of tribe
              membershipResponse(
                userTribeJoinRes,
              ).user.memberIds.length.should.be.equal(1);
              membershipResponse(
                userTribeJoinRes,
              ).user.member.length.should.be.equal(1);

              // Join tribe again
              agent
                .post('/api/users/memberships/' + tribe._id)
                .set('X-Trustroots-Request', '1')
                .send()
                .expect(409)
                .end(function (userTagJoin2Err, userTagJoin2Res) {
                  // Handle leaving tag error
                  if (userTagJoin2Err) {
                    return done(userTagJoin2Err);
                  }
                  errorResponse(userTagJoin2Res).message.should.be.equal(
                    'You are already a member of this tribe.',
                  );
                  return done();
                });
            });
        });
      });
  });
  it('should be able to show error if trying to leave tribe user is not member', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Japanese linguistics',
        });

        // Add tribe to test DB
        saveTribe(tribe, function (err, tribe) {
          should.not.exist(err);

          // Leave tribe
          agent
            .delete('/api/users/memberships/' + tribe._id)
            .set('X-Trustroots-Request', '1')
            .send()
            .expect(409)
            .end(function (userTribeJoinErr, userTribeJoinRes) {
              // Handle joining tag error
              if (userTribeJoinErr) {
                return done(userTribeJoinErr);
              }
              errorResponse(userTribeJoinRes).message.should.be.equal(
                'You are not a member of this tribe.',
              );
              return done();
            });
        });
      });
  });
  it('should be able to show error if trying to join non-existing tribe', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Join tribe
        agent
          .post('/api/users/memberships/572a3d36f905fe5c53bf1d1f')
          .set('X-Trustroots-Request', '1')
          .send()
          .expect(400)
          .end(function (userTribeJoinErr, userTribeJoinRes) {
            // Handle joining tag error
            if (userTribeJoinErr) {
              return done(userTribeJoinErr);
            }
            errorResponse(userTribeJoinRes).message.should.be.equal(
              'Bad request.',
            );
            return done();
          });
      });
  });
  it('should be able to show error if trying to join tribe with non standard ID', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Join tribe
        agent
          .post('/api/users/memberships/123456')
          .set('X-Trustroots-Request', '1')
          .send()
          .expect(400)
          .end(function (userTribeJoinErr, userTribeJoinRes) {
            // Handle joining tag error
            if (userTribeJoinErr) {
              return done(userTribeJoinErr);
            }
            errorResponse(userTribeJoinRes).message.should.be.equal(
              'Cannot interpret id.',
            );
            return done();
          });
      });
  });
});
