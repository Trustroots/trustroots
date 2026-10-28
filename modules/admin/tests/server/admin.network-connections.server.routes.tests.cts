import type {
  TestExpressApp,
  TestAgent,
} from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
require('should');

describe('Admin network connections routes', () => {
  let app: TestExpressApp;
  let adminAgent: TestAgent;
  let supportAgent: TestAgent;
  let regularAgent: TestAgent;
  let welcomeAgent: TestAgent;
  let savedUsers: Array<{ _id: import('mongoose').Types.ObjectId }>;

  before(async () => {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    const users = utils.generateUsersWithSharedPassword(4);
    users[0]!.roles = ['user', 'admin'];
    users[1]!.roles = ['user', 'support-team'];
    users[2]!.roles = ['user'];
    users[3]!.roles = ['user', 'welcome-team'];
    savedUsers = await utils.saveUsersWithCachedPasswords(users);
    adminAgent = request.agent(app);
    supportAgent = request.agent(app);
    regularAgent = request.agent(app);
    welcomeAgent = request.agent(app);
    await utils.signIn(users[0]!, adminAgent);
    await utils.signIn(users[1]!, supportAgent);
    await utils.signIn(users[2]!, regularAgent);
    await utils.signIn(users[3]!, welcomeAgent);
  });

  afterEach(utils.clearDatabase);

  it('finds previous and current email addresses for staff only', async () => {
    const id = savedUsers[2]!._id;
    await mongoose.connection.collection('users').updateOne(
      { _id: id },
      {
        $set: {
          email: 'current@example.test',
          connectionSearchKeys: ['email:previous@example.test'],
        },
      },
    );
    for (const address of ['previous@example.test', 'current@example.test']) {
      const response = await supportAgent
        .get('/api/admin/network-connections')
        .query({ network: 'email', identifier: address.toUpperCase() })
        .expect(200);
      const match = response.body.members.find(
        (member: { _id: string }) => member._id === String(id),
      );
      assert.equal(match.current, address.startsWith('current'));
      await regularAgent
        .get('/api/admin/network-connections')
        .query({ network: 'email', identifier: address })
        .expect(403);
    }
  });

  it('allows administrators and support staff, and rejects other roles', async () => {
    await request(app).get('/api/admin/network-connections').expect(403);
    await request(app)
      .get(`/api/admin/network-connections/${new mongoose.Types.ObjectId()}`)
      .expect(403);
    await regularAgent.get('/api/admin/network-connections').expect(403);
    await regularAgent
      .get(`/api/admin/network-connections/${new mongoose.Types.ObjectId()}`)
      .expect(403);
    await welcomeAgent
      .get('/api/admin/network-connections?network=github&identifier=member')
      .expect(403);

    await supportAgent
      .get('/api/admin/network-connections?network=github&identifier=member')
      .expect(200);
    await adminAgent
      .get('/api/admin/network-connections?network=github&identifier=member')
      .expect(200);
  });

  it('returns newest connection history first in stable pages of 50', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const history = Array.from({ length: 51 }, (_, index) => ({
      network: 'facebook',
      oldIdentifier: index === 0 ? null : `profile-${index - 1}`,
      newIdentifier: `profile-${index}`,
      changedAt: new Date(Date.UTC(2020, 0, index)),
      initial: index === 0,
    }));
    await mongoose.connection.collection('users').insertOne({
      _id: memberId,
      username: 'history-member',
      displayName: 'History Member',
      email: 'history-member@example.test',
      roles: ['user'],
      extSitesCouchers: 'current-couchers-profile',
      connectionHistory: history,
      connectionSearchKeys: ['facebook:profile-50'],
    });

    const firstResponse = await adminAgent
      .get(`/api/admin/network-connections/${memberId}?page=1`)
      .expect(200);
    const firstPage = firstResponse.body as {
      current: Array<{ network: string; identifier: string }>;
      history: Array<{ newIdentifier: string }>;
      page: number;
      hasNextPage: boolean;
    };
    firstPage.page.should.equal(1);
    firstPage.history.length.should.equal(50);
    firstPage.history[0]!.newIdentifier.should.equal('profile-50');
    firstPage.history[49]!.newIdentifier.should.equal('profile-1');
    firstPage.current.should.containEql({
      network: 'couchers',
      identifier: 'current-couchers-profile',
    });
    firstPage.hasNextPage.should.equal(true);

    const secondResponse = await supportAgent
      .get(`/api/admin/network-connections/${memberId}?page=2`)
      .expect(200);
    const secondPage = secondResponse.body as {
      history: Array<{ newIdentifier: string }>;
      page: number;
      hasNextPage: boolean;
    };
    secondPage.page.should.equal(2);
    secondPage.history.length.should.equal(1);
    secondPage.history[0]!.newIdentifier.should.equal('profile-0');
    secondPage.hasNextPage.should.equal(false);
  });

  it('finds exact current and historical matches from profile URLs without duplicate member rows', async () => {
    const currentId = new mongoose.Types.ObjectId('000000000000000000000001');
    const historicalId = new mongoose.Types.ObjectId(
      '000000000000000000000002',
    );
    await mongoose.connection.collection('users').insertMany([
      {
        _id: currentId,
        username: 'current-match',
        displayName: 'Current Match',
        email: 'current-match@example.test',
        roles: ['user'],
        additionalProvidersData: { github: { login: 'RiverGuide' } },
        connectionHistory: [
          {
            network: 'github',
            oldIdentifier: null,
            newIdentifier: 'RiverGuide',
            changedAt: new Date('2024-01-01T00:00:00.000Z'),
            initial: true,
          },
        ],
        // Duplicate stored keys still produce one row for this member.
        connectionSearchKeys: ['github:riverguide', 'github:riverguide'],
      },
      {
        _id: historicalId,
        username: 'historical-match',
        displayName: 'Historical Match',
        email: 'historical-match@example.test',
        roles: ['user'],
        additionalProvidersData: { github: { login: 'DifferentHandle' } },
        connectionHistory: [
          {
            network: 'github',
            oldIdentifier: 'RiverGuide',
            newIdentifier: 'DifferentHandle',
            changedAt: new Date('2025-01-01T00:00:00.000Z'),
            initial: false,
          },
        ],
        connectionSearchKeys: ['github:riverguide', 'github:differenthandle'],
      },
    ]);

    const response = await supportAgent
      .get(
        '/api/admin/network-connections?network=github&identifier=https%3A%2F%2Fgithub.com%2FRiverGuide',
      )
      .expect(200);
    const body = response.body as {
      members: Array<{
        _id: string;
        username: string;
        identifier: string;
        current: boolean;
      }>;
      page: number;
      hasNextPage: boolean;
    };
    body.members
      .map(member => member._id)
      .should.eql([currentId.toString(), historicalId.toString()]);
    body.members.length.should.equal(2);
    body.members[0]!.username.should.equal('current-match');
    body.members[0]!.identifier.should.equal('riverguide');
    body.members[0]!.current.should.equal(true);
    body.members[1]!.username.should.equal('historical-match');
    body.members[1]!.current.should.equal(false);
    body.page.should.equal(1);
    body.hasNextPage.should.equal(false);

    const auditEntries = await mongoose
      .model('AuditLog')
      .find({ user: savedUsers[1]!._id })
      .lean<Array<{ route?: string; query: unknown }>>();
    const searchAudit = auditEntries.find(entry =>
      entry.route?.endsWith('/network-connections'),
    );
    assert.ok(searchAudit);
    assert.deepStrictEqual(searchAudit.query, {
      page: 1,
      network: 'github',
    });
    assert.equal(JSON.stringify(searchAudit).includes('riverguide'), false);

    const unmatched = await adminAgent
      .get(
        '/api/admin/network-connections?network=github&identifier=https%3A%2F%2Fgithub.com%2Fno-such-member',
      )
      .expect(200);
    (unmatched.body as { members: unknown[] }).members.length.should.equal(0);
  });

  it('paginates 51 matching members returned by MongoDB', async () => {
    const members = Array.from({ length: 51 }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(
        (index + 100).toString(16).padStart(24, '0'),
      ),
      username: `bulk-member-${index}`,
      displayName: `Bulk Member ${index}`,
      email: `bulk-member-${index}@example.test`,
      roles: ['user'],
      additionalProvidersData: { github: { login: 'bulk-handle' } },
      connectionHistory: [],
      connectionSearchKeys: ['github:bulk-handle'],
    }));
    await mongoose.connection.collection('users').insertMany(members);

    const firstResponse = await supportAgent
      .get(
        '/api/admin/network-connections?network=github&identifier=bulk-handle&page=1',
      )
      .expect(200);
    const firstPage = firstResponse.body as {
      members: Array<{ _id: string; current: boolean }>;
      page: number;
      hasNextPage: boolean;
    };
    firstPage.page.should.equal(1);
    firstPage.members.length.should.equal(50);
    firstPage.members[0]!._id.should.equal(members[0]!._id.toString());
    firstPage.members.every(member => member.current).should.equal(true);
    firstPage.hasNextPage.should.equal(true);

    const secondResponse = await adminAgent
      .get(
        '/api/admin/network-connections?network=github&identifier=bulk-handle&page=2',
      )
      .expect(200);
    const secondPage = secondResponse.body as {
      members: Array<{ _id: string; current: boolean }>;
      page: number;
      hasNextPage: boolean;
    };
    secondPage.page.should.equal(2);
    secondPage.members.length.should.equal(1);
    secondPage.members[0]!._id.should.equal(members[50]!._id.toString());
    secondPage.members[0]!.current.should.equal(true);
    secondPage.hasNextPage.should.equal(false);
  });

  it('validates search and history requests at the route boundary', async () => {
    const invalidSearch = await supportAgent
      .get('/api/admin/network-connections?network=unknown&identifier=member')
      .expect(400);
    invalidSearch.body.message.should.equal('Invalid connection search.');

    const missingHistory = await adminAgent
      .get(`/api/admin/network-connections/${new mongoose.Types.ObjectId()}`)
      .expect(404);
    missingHistory.body.message.should.equal('Member not found.');

    // A non-member path cannot be interpreted as an ObjectId by the controller.
    const invalidHistory = await adminAgent
      .get('/api/admin/network-connections/not-an-id')
      .expect(400);
    invalidHistory.body.message.should.equal(
      'Invalid connection history request.',
    );
  });
});
