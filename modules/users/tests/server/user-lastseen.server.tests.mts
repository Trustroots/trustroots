import request from 'supertest';
import moment from 'moment';
import mongoose, { type QueryFilter, type HydratedDocument } from 'mongoose';
import should from 'should';
import sinon from 'sinon';
import config from './../../../../config/config.mts';
import express from './../../../../config/lib/express.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import lastSeen from './../../server/controllers/users.lastseen.server.controller.mts';
import { hashIpAddress } from '../../../core/server/services/ip-hash.server.service.mts';
import type { UserRecord } from '../../../../testutils/server/model-contracts.mts';

interface LastSeenUserRecord extends UserRecord {
  seen?: Date;
  lastIpHash?: string;
}

const User = mongoose.model<LastSeenUserRecord>('User');
type LastSeenDocument = HydratedDocument<LastSeenUserRecord>;
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

    it('uses the socket-derived request address when Passenger is unavailable', () => {
      const req = {
        get: () => undefined,
        ip: '2001:db8::1',
      };
      lastSeen.getClientIpAddress(req as never)!.should.equal('2001:db8::1');
    });

    it('does not store an invalid client address', () => {
      const req = {
        get: () => 'not-an-ip-address',
        ip: 'not-an-ip-address',
      };
      should(lastSeen.getClientIpAddress(req as never)).be.undefined();
    });

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
    it('should update the last seen date only after the configured interval', async function () {
      sinon
        .stub(config.limits, 'timeToUpdateLastSeenUser')
        .value({ minutes: 1 });
      const seenAfterRequest = async (tick: number) => {
        sinon.clock.tick(tick);
        await agent.get('/api/messages').expect(200);
        const user = await User.findOne({ username: _confirmedUser.username });
        assertUser(user);
        return user.seen;
      };
      const originalTime = new Date();

      should(await seenAfterRequest(0)).eql(originalTime);
      // Exactly the interval is not enough; one more millisecond is.
      should(await seenAfterRequest(60 * 1000)).eql(originalTime);
      should(await seenAfterRequest(1)).eql(new Date());
    });
  });
});

describe('Last seen middleware', function () {
  type Middleware = (
    req: object,
    res: object,
    next: (error?: unknown) => void,
  ) => void;
  const middleware = lastSeen as unknown as Middleware;

  const now = new Date('2026-01-02T03:04:05.000Z');
  const interval = moment
    .duration(config.limits.timeToUpdateLastSeenUser)
    .asMilliseconds();
  const ip = '192.0.2.1';
  const otherIp = '192.0.2.2';

  beforeEach(() => sinon.useFakeTimers({ now, toFake: ['Date'] }));
  afterEach(() => sinon.restore());

  const cases: Array<
    [string, { seenAgo?: number; ip: string } | null, object | null]
  > = [
    ['skips anonymous requests', null, null],
    [
      'skips a recent visit from the same address',
      { seenAgo: interval, ip },
      null,
    ],
    [
      'skips a recent visit without a valid address',
      { seenAgo: 0, ip: 'not-an-ip' },
      null,
    ],
    [
      'stores a changed address without touching seen',
      { seenAgo: 0, ip: otherIp },
      { lastIpHash: hashIpAddress(otherIp) },
    ],
    [
      'updates seen after the interval',
      { seenAgo: interval + 1, ip },
      { seen: now },
    ],
    [
      'stores both on a first visit',
      { ip: otherIp },
      { seen: now, lastIpHash: hashIpAddress(otherIp) },
    ],
  ];
  cases.forEach(([name, visit, update]) => {
    it(name, async () => {
      const findByIdAndUpdate = sinon
        .stub(User, 'findByIdAndUpdate')
        .resolves(null);
      const user = visit && {
        id: 'member-id',
        lastIpHash: hashIpAddress(ip),
        seen:
          visit.seenAgo === undefined
            ? undefined
            : new Date(now.getTime() - visit.seenAgo),
      };
      const error = await new Promise(resolve =>
        middleware({ user, get: () => undefined, ip: visit?.ip }, {}, resolve),
      );
      should(error).be.undefined();
      // Serialised, because the fake-timer Date has its own prototype.
      JSON.stringify(findByIdAndUpdate.args).should.equal(
        JSON.stringify(update ? [['member-id', update]] : []),
      );
    });
  });
});
