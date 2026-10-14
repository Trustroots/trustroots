import type {
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const should: typeof import('should') = require('should');
const sinon: typeof import('sinon') = require('sinon');
const influxService: typeof import('../../../stats/server/services/influx.server.service.mts') = require('../../../stats/server/services/influx.server.service.mts');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: typeof import('../../../../config/lib/express.mjs').default = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model<UserRecord, UserModel>('User');

describe('Sign-in session confirmation', function () {
  let app: Awaited<ReturnType<typeof express.init>>;

  before(async function () {
    app = await express.init(mongoose.connection);
  });

  afterEach(() => sinon.restore());
  afterEach(utils.clearDatabase);

  it('returns an anonymous identity without creating a cookie or allowing caching', async function () {
    const response = await request(app).get('/api/auth/session').expect(200);
    response.body.should.deepEqual({ userId: null });
    response.headers['cache-control'].should.equal('no-store');
    response.headers.vary.should.match(/Cookie/);
    should(response.headers['set-cookie']).be.undefined();
  });

  it('recognises the signed-in account only when its session cookie is returned', async function () {
    const credentials = {
      username: 'sessiontestmember',
      password: 'ExamplePassword123!',
    };
    const user = await new User({
      ...credentials,
      firstName: 'Example',
      lastName: 'Member',
      displayName: 'Example Member',
      email: 'session-member@example.test',
      provider: 'local',
      roles: ['user'],
    }).save();
    const backend = sinon.stub(influxService, 'stat');
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    backend.called.should.be.true();
    backend.getCalls().forEach(call => call.args[1](new Error('unavailable')));
    const response = await agent.get('/api/auth/session').expect(200);
    response.body.should.deepEqual({ userId: String(user._id) });
    response.headers['cache-control'].should.equal('no-store');
    response.headers.vary.should.match(/Cookie/);

    const withoutCookie = await request(app)
      .get('/api/auth/session')
      .expect(200);
    withoutCookie.body.should.deepEqual({ userId: null });
    await agent
      .post('/api/auth/signout')
      .set('X-Trustroots-Request', '1')
      .expect(302);
    const signedOut = await agent.get('/api/auth/session').expect(200);
    signedOut.body.should.deepEqual({ userId: null });
  });
});
