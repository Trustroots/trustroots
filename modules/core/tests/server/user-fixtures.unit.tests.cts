const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
require('../../../users/server/models/user.server.model.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mjs') = require('../../../../testutils/server/data.server.testutil');

const User =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').UserRecord
  >('User');

type SaveHooks = {
  hooks: {
    execPre(name: 'save', context: object, args: object[]): Promise<unknown>;
  };
};

// Exercise real validation and save middleware without a database connection.
async function runSaveMiddleware(
  this: import('../../../../testutils/server/model-contracts.mts').UserModelDocument,
) {
  const schemaInternals = User.schema as unknown as { s: SaveHooks };
  await this.validate();
  await schemaInternals.s.hooks.execPre('save', this, [{}]);
  return this;
}

describe('Reusable user fixture passwords', () => {
  beforeEach(() => {
    sinon.stub(User.prototype, 'save').callsFake(runSaveMiddleware);
  });

  afterEach(() => sinon.restore());

  it('generates unique fixture identities with repeatable plaintext passwords', () => {
    const users = utils.generateUsersWithSharedPassword(3, { public: true });
    assert.equal(users.length, 3);
    assert.equal(new Set(users.map(user => user.username)).size, 3);
    assert.equal(new Set(users.map(user => user.email)).size, 3);
    assert.equal(new Set(users.map(user => user.password)).size, 1);
    assert.ok(users.every(user => user.public === true));
    assert.equal(
      users[0].password,
      utils.generateUsersWithSharedPassword(1)[0].password,
    );
  });
});
