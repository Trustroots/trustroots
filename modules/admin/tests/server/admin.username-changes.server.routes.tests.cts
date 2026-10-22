import type {
  TestExpressApp,
  TestAgent,
} from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const assert: typeof import('node:assert') = require('assert');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
require('should');

interface UsernameChange {
  _id: string;
  currentUsername: string;
  displayName?: string;
  oldUsername: string | null;
  newUsername: string;
  changedAt: string;
  legacy: boolean;
}

interface UsernameChangesPage {
  changes: UsernameChange[];
  page: number;
  hasNextPage: boolean;
  range: '90d' | 'all';
}

describe('Admin username changes route', () => {
  type TestUser = ReturnType<
    typeof utils.generateUsersWithSharedPassword
  >[number] & {
    displayName?: string;
    usernameHistory?: Array<{
      oldUsername: string;
      newUsername: string;
      changedAt: Date;
    }>;
    usernameUpdated?: Date;
  };

  let app: TestExpressApp;
  let adminAgent: TestAgent;
  let regularAgent: TestAgent;
  let users: TestUser[];
  let savedUsers: Array<{
    _id: import('mongoose').Types.ObjectId;
    displayName?: string;
  }>;

  before(async () => {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    users = utils.generateUsersWithSharedPassword(8);
    users[0].roles = ['user', 'admin'];
    users[1].roles = ['user'];
    users[2].displayName = 'Member with history';

    users[2].usernameHistory = Array.from({ length: 49 }, (_, index) => ({
      oldUsername: `old-${index}`,
      newUsername: users[2]!.username,
      changedAt: new Date(now - 5_000 - index * 1_000),
    }));
    users[3].usernameHistory = [
      {
        oldUsername: 'second-user-recent-old',
        newUsername: users[3]!.username,
        changedAt: new Date(now - 5_000),
      },
      {
        oldUsername: 'second-user-next-old',
        newUsername: users[3]!.username,
        changedAt: new Date(now - 54_000),
      },
    ];
    users[4].usernameHistory = [
      {
        oldUsername: 'at-boundary-old',
        newUsername: users[4]!.username,
        changedAt: new Date(now - ninetyDays + 60_000),
      },
    ];
    users[5].usernameHistory = [
      {
        oldUsername: 'older-old',
        newUsername: users[5]!.username,
        changedAt: new Date(now - ninetyDays - 60_000),
      },
    ];
    users[6].usernameHistory = [
      {
        oldUsername: 'future-old',
        newUsername: users[6]!.username,
        changedAt: new Date(now + 60_000),
      },
    ];
    // Historical profiles have a timestamp but no recorded previous name.
    users[7].usernameUpdated = new Date(now - 100_000);
    savedUsers = await utils.saveUsersWithCachedPasswords(users);
    adminAgent = request.agent(app);
    regularAgent = request.agent(app);
  });

  afterEach(utils.clearDatabase);

  it('restricts the endpoint to administrators', async () => {
    await request(app).get('/api/admin/username-changes').expect(403);
    await utils.signIn(users[1], regularAgent);
    await regularAgent.get('/api/admin/username-changes').expect(403);
  });

  it('returns recent history in stable pages of 50 and includes unknown legacy names', async () => {
    await utils.signIn(users[0], adminAgent);
    const firstResponse = await adminAgent
      .get('/api/admin/username-changes?page=1')
      .expect(200);
    const firstPage = firstResponse.body as UsernameChangesPage;
    firstPage.page.should.equal(1);
    firstPage.range.should.equal('90d');
    firstPage.changes.length.should.equal(50);
    firstPage.hasNextPage.should.be.true();
    assert.strictEqual(firstPage.changes[0]!.oldUsername, 'old-0');
    firstPage.changes[0]!.newUsername.should.equal(users[2]!.username);
    [firstPage.changes[0]!._id, firstPage.changes[1]!._id].should.eql(
      [savedUsers[2]!._id.toString(), savedUsers[3]!._id.toString()].sort(),
    );

    const secondResponse = await adminAgent
      .get('/api/admin/username-changes?page=2')
      .expect(200);
    const secondPage = secondResponse.body as UsernameChangesPage;
    secondPage.page.should.equal(2);
    secondPage.changes.length.should.equal(3);
    secondPage.hasNextPage.should.be.false();

    const returnedIds = [...firstPage.changes, ...secondPage.changes].map(
      change => change._id,
    );
    returnedIds.should.have.length(53);
    returnedIds.should.not.containEql(savedUsers[5]!._id.toString());
    returnedIds.should.not.containEql(savedUsers[6]!._id.toString());
    const legacy = [...firstPage.changes, ...secondPage.changes].find(
      change => change._id === savedUsers[7]!._id.toString(),
    );
    if (!legacy) throw new Error('Expected legacy username change fallback');
    assert.strictEqual(legacy.oldUsername, null);
    legacy.legacy.should.be.true();
    legacy.newUsername.should.equal(users[7]!.username);
    assert.strictEqual(
      firstPage.changes[0]!.displayName,
      savedUsers[2]!.displayName,
    );
  });

  it('supports all recorded history and rejects invalid filters', async () => {
    await utils.signIn(users[0], adminAgent);
    const response = await adminAgent
      .get('/api/admin/username-changes?range=all&page=2')
      .expect(200);
    const page = response.body as UsernameChangesPage;
    page.range.should.equal('all');
    page.changes
      .some(change => change._id === savedUsers[5]!._id.toString())
      .should.be.true();
    page.changes
      .some(change => change._id === savedUsers[6]!._id.toString())
      .should.be.false();

    for (const query of ['page=9007199254740992', 'range=invalid']) {
      const response = await adminAgent.get(
        `/api/admin/username-changes?${query}`,
      );
      assert.strictEqual(
        response.status,
        400,
        `Expected ${query} to be rejected, received ${JSON.stringify(response.body)}`,
      );
      response.body.message.should.equal('Invalid username change filters.');
    }
  });
});
