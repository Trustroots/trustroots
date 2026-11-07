const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mjs') = require('../../../../testutils/server/data.server.testutil');
const User =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').UserRecord
  >('User');
describe('Volunteers page route tests', function () {
  let app: import('express').Express;
  let agent: import('supertest').Agent;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  afterEach(utils.clearDatabase);
  it('returns only public current greeters with public fields in name order', async function () {
    await User.create([
      {
        public: true,
        firstName: 'Zed',
        lastName: 'Greeter',
        displayName: 'Zed Greeter',
        email: 'zed@example.com',
        username: 'zedgreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team'],
      },
      {
        public: true,
        firstName: 'Ada',
        lastName: 'Greeter',
        displayName: 'Ada Greeter',
        email: 'ada@example.com',
        username: 'adagreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team'],
      },
      {
        public: true,
        firstName: 'Suspended',
        lastName: 'Greeter',
        email: 'suspended@example.com',
        username: 'suspendedgreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team', 'suspended'],
      },
      {
        public: true,
        firstName: 'Shadowbanned',
        lastName: 'Greeter',
        email: 'shadow@example.com',
        username: 'shadowgreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team', 'shadowban'],
      },
      {
        public: false,
        firstName: 'Private',
        lastName: 'Greeter',
        email: 'private@example.com',
        username: 'privategreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team'],
      },
    ]);
    const response = await agent.get('/api/greeters').expect(200);
    response.body.greeters
      .map(({ displayName }: { displayName: string }) => displayName)
      .should.deepEqual(['Ada Greeter', 'Zed Greeter']);
    response.body.greeters.forEach((greeter: Record<string, unknown>) => {
      Object.keys(greeter)
        .sort()
        .should.deepEqual(['_id', 'displayName', 'username']);
    });
  });
});
