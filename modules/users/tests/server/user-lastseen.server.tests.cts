import type { QueryFilter, HydratedDocument } from 'mongoose';
import type { UserRecord } from '../../../../testutils/server/model-contracts.mts';
const {
  hashIpAddress,
}: typeof import('../../../core/server/services/ip-hash.server.service.mts') = require('../../../core/server/services/ip-hash.server.service.mts');

const request: typeof import('supertest') = require('supertest');
const moment: typeof import('moment') = require('moment');
const mongoose: typeof import('mongoose') = require('mongoose');
const should: typeof import('should') = require('should');
const sinon: typeof import('sinon') = require('sinon');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const express: {
  init(
    connection: import('mongoose').Connection,
  ): Promise<import('express').Express>;
} = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
interface LastSeenUserRecord extends UserRecord {
  seen?: Date;
  lastIpHash?: string;
}
interface LastSeenRequest {
  get(name: string): string | undefined;
  ip: string;
  user?: { id: string; lastIpHash?: string; seen?: Date };
}
const lastSeen: {
  (
    req: LastSeenRequest,
    res: import('express').Response,
    next: (error?: unknown) => void,
  ): void;
  getClientIpAddress(
    req: Pick<LastSeenRequest, 'get' | 'ip'>,
  ): string | undefined;
} = require('./../../server/controllers/users.lastseen.server.controller.mjs');
const User = mongoose.model<LastSeenUserRecord>('User');
type LastSeenDocument = HydratedDocument<LastSeenUserRecord>;
type CallbackUpdate = (
  id: string,
  update: Partial<LastSeenUserRecord>,
  callback: (error?: unknown) => void,
) => void;
function findUser(
  filter: QueryFilter<LastSeenUserRecord>,
  callback: (error: unknown | null, user: LastSeenDocument | null) => void,
): void {
  void User.findOne(filter).then(
    user => callback(null, user),
    error => callback(error, null),
  );
}
function assertUser(
  user: LastSeenDocument | null,
): asserts user is LastSeenDocument {
  if (!user) throw new Error('expected the user fixture to exist');
}
describe('User last seen CRUD tests', function () {
  /**
   * Globals
   */
  let app: import('express').Express;
  let agent: ReturnType<typeof request.agent>;
  let _confirmedUser: LastSeenUserRecord;
  let confirmedUser: LastSeenDocument;
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(function () {
    sinon.useFakeTimers({
      // MongoDB uses real time to expire authentication sessions.
      now: Date.now(),
      toFake: ['Date'],
    });
  });
  afterEach(function () {
    sinon.restore();
  });

  // Create a confirmed user

  beforeEach(async function () {
    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'confirmed-test@test.com',
      username: 'usertest',
      password: 'aPassWoRd_*....',
      provider: 'local',
    };
    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    await confirmedUser.save();
  });
  afterEach(utils.clearDatabase);
  context('logged in', function () {
    // Sign in
    beforeEach(async () => {
      const credentials = {
        username: _confirmedUser.username!,
        password: _confirmedUser.password!,
      };
      await utils.signIn(credentials, agent);
    });

    // Sign out
    afterEach(async () => {
      await utils.signOut(agent);
    });
    afterEach(utils.clearDatabase);
    it('should update the last seen date of logged user when accessing api', function (done) {
      // Read statistics
      sinon.clock.tick(20);
      agent
        .get('/api/messages')
        .expect(200)
        .end(function (err) {
          if (err) return done(err);

          // read user from database
          findUser(
            {
              username: _confirmedUser.username,
            },
            function (err, user) {
              try {
                if (err) throw err;
                assertUser(user);
                should(user.seen).eql(new Date());
                user.lastIpHash!.should.be.String();
                return done();
              } catch (err) {
                return done(err);
              }
            },
          );
        });
    });
    it('prefers the trusted Passenger client address', () => {
      const req = {
        get: (header: string) =>
          header === '!~Passenger-Client-Address' ? '203.0.113.24' : undefined,
        ip: '198.51.100.24',
      };
      lastSeen.getClientIpAddress(req)!.should.equal('203.0.113.24');
    });
    it('uses the socket-derived request address when Passenger is unavailable', () => {
      const req = {
        get: () => undefined,
        ip: '2001:db8::1',
      };
      lastSeen.getClientIpAddress(req)!.should.equal('2001:db8::1');
    });
    it('does not store an invalid client address', () => {
      const req = {
        get: () => 'not-an-ip-address',
        ip: 'not-an-ip-address',
      };
      should(lastSeen.getClientIpAddress(req)).be.undefined();
    });
    it('updates a changed IP address without advancing the last-seen timestamp', async () => {
      const findByIdAndUpdate = sinon.stub(
        User,
        'findByIdAndUpdate',
      ) as unknown as sinon.SinonStub<Parameters<CallbackUpdate>, void>;
      findByIdAndUpdate.resolves();
      const req: LastSeenRequest = {
        get: () => '203.0.113.24',
        ip: '198.51.100.24',
        user: {
          id: 'user-id',
          lastIpHash: hashIpAddress('203.0.113.23'),
          seen: new Date(),
        },
      };
      await new Promise<void>((resolve, reject) => {
        lastSeen(req, {} as unknown as import('express').Response, err =>
          err ? reject(err) : resolve(),
        );
      });
      sinon.assert.calledOnce(findByIdAndUpdate);
      findByIdAndUpdate.firstCall.args[0].should.equal('user-id');
      findByIdAndUpdate.firstCall.args[1].should.deepEqual({
        lastIpHash: hashIpAddress('203.0.113.24'),
      });
    });
    it('should update the last seen date only if a specific time passed since the last update', function (done) {
      // the user's username, shortcut
      const username = _confirmedUser.username;

      // how long should we wait between updates on minimum
      const minutesToUpdate = {
        minutes: 1,
      }; // 1 minute

      sinon
        .stub(config.limits, 'timeToUpdateLastSeenUser')
        .value(minutesToUpdate);
      const timeToUpdate = moment.duration(minutesToUpdate).asMilliseconds();
      const originalTime = new Date();
      // update for the first time, OK
      agent
        .get('/api/messages')
        .expect(200)
        .end(function () {
          // read user from database
          findUser(
            {
              username,
            },
            function (err, user) {
              try {
                if (err) throw err;
                assertUser(user);
                should(user.seen).eql(originalTime);

                // now wait almost for the time to update
                sinon.clock.tick(timeToUpdate - 1);
                agent
                  .get('/api/messages')
                  .expect(200)
                  .end(function () {
                    // and the User.seen should not be updated (too early)
                    findUser(
                      {
                        username,
                      },
                      function (err, user) {
                        try {
                          if (err) throw err;
                          assertUser(user);
                          should(user.seen).eql(originalTime);

                          // now wait for another 2 milliseconds
                          sinon.clock.tick(2);
                          agent
                            .get('/api/messages')
                            .expect(200)
                            .end(function () {
                              // and the User.seen should be updated now
                              findUser(
                                {
                                  username,
                                },
                                function (err, user) {
                                  if (err) return done(err);
                                  try {
                                    assertUser(user);
                                    should(user.seen).eql(new Date());
                                    return done();
                                  } catch (error) {
                                    return done(error);
                                  }
                                },
                              );
                            });
                        } catch (err) {
                          return done(err);
                        }
                      },
                    );
                  });
              } catch (err) {
                return done(err);
              }
            },
          );
        });
    });
  });
});
