import 'should';
import type { Express } from 'express';
import mongoose from 'mongoose';
import request, { type Agent } from 'supertest';
import express from '../../../../config/lib/express.mts';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';
import type { UserRecord } from '../../../../testutils/server/model-contracts.mts';

const User = mongoose.model<UserRecord>('User');
describe('Volunteers page route tests', function () {
  let app: Express;
  let agent: Agent;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  afterEach(clearDatabase);
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
