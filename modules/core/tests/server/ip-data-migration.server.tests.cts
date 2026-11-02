const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
let pseudonymiseIpAddresses: typeof import('../../../../bin/db-maintenance/pseudonymise-ip-addresses.mts').pseudonymiseIpAddresses;
const {
  hashIpAddress,
}: typeof import('../../server/services/ip-hash.server.service.mts') = require('../../server/services/ip-hash.server.service.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

describe('IP data migration', () => {
  const secret = 'fictional-migration-key-at-least-32-bytes';
  before(async () => {
    ({ pseudonymiseIpAddresses } =
      await import('../../../../bin/db-maintenance/pseudonymise-ip-addresses.mts'));
  });
  afterEach(utils.clearDatabase);
  afterEach(() => sinon.restore());

  it('does not overwrite an identifier refreshed during migration', async () => {
    const db = mongoose.connection.db!;
    const users = db.collection('users');
    const { insertedId } = await users.insertOne({
      username: 'migration-race',
      lastIpAddress: '203.0.113.10',
    });
    const originalUpdate = users.updateOne.bind(users);
    const collection = sinon.stub(db, 'collection').callThrough();
    collection.withArgs('users').returns(users);
    sinon.stub(users, 'updateOne').callsFake(async (filter, update) => {
      await originalUpdate(
        { _id: insertedId },
        { $set: { lastIpHash: 'b'.repeat(64) } },
      );
      return originalUpdate(filter, update);
    });
    assert.deepEqual(
      await pseudonymiseIpAddresses(db, { secret, apply: true }),
      { users: 1, converted: 0, changedConcurrently: 1, auditLogs: 0 },
    );
    assert.equal(
      (await users.findOne({ _id: insertedId }))!.lastIpHash,
      'b'.repeat(64),
    );
    sinon.restore();
    assert.equal(
      (await pseudonymiseIpAddresses(db, { secret, apply: true })).converted,
      1,
    );
    assert.equal(
      (await users.findOne({ _id: insertedId }))!.lastIpAddress,
      undefined,
    );
  });

  it('requires a dedicated key even for a dry run', async () => {
    await assert.rejects(
      pseudonymiseIpAddresses(mongoose.connection.db!, { secret: '' }),
      /Configure/,
    );
  });

  it('supports dry runs, preserves identifiers and removes legacy data idempotently', async () => {
    const db = mongoose.connection.db!;
    const users = db.collection('users');
    const audits = db.collection('auditlogs');
    await users.insertMany([
      {
        username: 'migration-a',
        email: 'migration-a@example.test',
        lastIpAddress: '203.0.113.10',
      },
      {
        username: 'migration-b',
        email: 'migration-b@example.test',
        lastIpAddress: 'invalid',
      },
      {
        username: 'migration-c',
        email: 'migration-c@example.test',
        lastIpAddress: null,
      },
      {
        username: 'migration-d',
        email: 'migration-d@example.test',
        lastIpAddress: '203.0.113.11',
        lastIpHash: 'a'.repeat(64),
      },
    ]);
    await audits.insertOne({
      ip: '203.0.113.20',
      body: { ipAddress: '203.0.113.10', action: 'search' },
      query: { ip: '203.0.113.10', ipAddress: '203.0.113.10' },
    });
    assert.deepEqual(await pseudonymiseIpAddresses(db, { secret }), {
      users: 4,
      converted: 0,
      changedConcurrently: 0,
      auditLogs: 1,
    });
    assert.equal(
      await users.countDocuments({ lastIpAddress: { $exists: true } }),
      4,
    );
    assert.deepEqual(
      await pseudonymiseIpAddresses(db, { secret, apply: true }),
      { users: 4, converted: 4, changedConcurrently: 0, auditLogs: 1 },
    );
    assert.equal(
      await users.countDocuments({ lastIpAddress: { $exists: true } }),
      0,
    );
    assert.equal(
      (await users.findOne({ username: 'migration-a' }))!.lastIpHash,
      hashIpAddress('203.0.113.10', secret),
    );
    assert.equal(
      (await users.findOne({ username: 'migration-b' }))!.lastIpHash,
      undefined,
    );
    assert.equal(
      (await users.findOne({ username: 'migration-d' }))!.lastIpHash,
      'a'.repeat(64),
    );
    const audit = await audits.findOne({});
    assert.equal(audit!.ip, undefined);
    assert.deepEqual(audit!.body, { action: 'search' });
    assert.deepEqual(audit!.query, {});
    assert.deepEqual(
      await pseudonymiseIpAddresses(db, { secret, apply: true }),
      { users: 0, converted: 0, changedConcurrently: 0, auditLogs: 0 },
    );
  });
});
