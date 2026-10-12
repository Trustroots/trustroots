const assert = require('assert/strict');
const mongoose = require('mongoose');
const {
  hashToken,
} = require('../../server/services/action-token.server.service.mjs');
let hashLegacyTokens;

describe('Legacy account action token migration', function () {
  let collection;
  before(async () => {
    ({ hashLegacyTokens } = await import(
      '../../../../bin/db-maintenance/hash-account-action-tokens.mjs'
    ));
    collection = mongoose.connection.db.collection(
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
    assert.equal(
      (await collection.findOne({})).emailToken,
      'fictional-confirmation',
    );
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
    assert.equal(user.emailToken, hashToken('fictional-confirmation'));
    assert.equal(user.resetPasswordToken, hashToken('fictional-reset'));
    assert.equal(user.removeProfileToken, hashToken('fictional-removal'));
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
    const wrapper = {
      find: (...args) => collection.find(...args),
      async updateOne(query, update) {
        await collection.updateOne(
          { _id: insertedId },
          { $unset: { emailToken: 1 } },
        );
        return collection.updateOne(query, update);
      },
    };
    assert.deepEqual(await hashLegacyTokens(wrapper, { apply: true }), {
      candidates: 1,
      converted: 0,
      changedConcurrently: 1,
    });
    assert.equal((await collection.findOne({})).emailToken, undefined);
  });
});
