import type { Collection, Filter, FindOptions } from 'mongodb';
import type { UserTokenRecord } from '../../../../bin/db-maintenance/hash-account-action-tokens.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const {
  hashToken,
}: typeof import('../../server/services/action-token.server.service.mjs') = require('../../server/services/action-token.server.service.mjs');
let hashLegacyTokens: typeof import('../../../../bin/db-maintenance/hash-account-action-tokens.mts').hashLegacyTokens;

describe('Legacy account action token migration', function () {
  let collection: Collection<UserTokenRecord>;
  before(async () => {
    ({ hashLegacyTokens } =
      await import('../../../../bin/db-maintenance/hash-account-action-tokens.mts'));
    const db = mongoose.connection.db;
    assert.ok(db);
    collection = db.collection<UserTokenRecord>(
      'action_token_migration_fixtures',
    );
  });
  afterEach(async () => {
    await collection.deleteMany({});
  });
  it('defaults to a dry run and preserves original tokens', async function () {
    await collection.insertOne({
      emailToken: 'fictional-confirmation',
      resetPasswordToken: 'fictional-reset',
      removeProfileToken: 'fictional-removal',
    });
    assert.deepEqual(await hashLegacyTokens(collection), {
      candidates: 3,
      converted: 0,
      changedConcurrently: 0,
    });
    const unchanged = await collection.findOne({});
    assert.ok(unchanged);
    assert.equal(unchanged.emailToken, 'fictional-confirmation');
  });
  it('hashes all legacy fields while preserving links, expiry and idempotence', async function () {
    const expires = new Date(Date.now() + 100000);
    await collection.insertMany([
      {
        emailToken: 'fictional-confirmation',
        resetPasswordToken: 'fictional-reset',
        removeProfileToken: 'fictional-removal',
        resetPasswordExpires: expires,
      },
      {
        emailToken: hashToken('already-protected'),
        resetPasswordToken: '',
        removeProfileToken: null,
      },
      { emailToken: 'legacy-only' },
    ]);
    assert.deepEqual(await hashLegacyTokens(collection, { apply: true }), {
      candidates: 4,
      converted: 4,
      changedConcurrently: 0,
    });
    const user = await collection.findOne({ resetPasswordExpires: expires });
    assert.ok(user);
    assert.equal(user.emailToken, hashToken('fictional-confirmation'));
    assert.equal(user.resetPasswordToken, hashToken('fictional-reset'));
    assert.equal(user.removeProfileToken, hashToken('fictional-removal'));
    assert.ok(user.resetPasswordExpires);
    assert.equal(user.resetPasswordExpires.getTime(), expires.getTime());
    assert.deepEqual(await hashLegacyTokens(collection, { apply: true }), {
      candidates: 0,
      converted: 0,
      changedConcurrently: 0,
    });
  });
  it('does not restore tokens consumed concurrently', async function () {
    const { insertedId } = await collection.insertOne({
      emailToken: 'soon-consumed',
    });
    const wrapper: Pick<Collection<UserTokenRecord>, 'find' | 'updateOne'> = {
      find: (
        filter: Filter<UserTokenRecord> = {},
        options?: FindOptions<UserTokenRecord>,
      ) => collection.find(filter, options),
      async updateOne(filter, update) {
        await collection.updateOne(
          { _id: insertedId },
          { $unset: { emailToken: 1 } },
        );
        return collection.updateOne(filter, update);
      },
    };
    assert.deepEqual(await hashLegacyTokens(wrapper, { apply: true }), {
      candidates: 1,
      converted: 0,
      changedConcurrently: 1,
    });
    const consumed = await collection.findOne({});
    assert.ok(consumed);
    assert.equal(consumed.emailToken, undefined);
  });
});
