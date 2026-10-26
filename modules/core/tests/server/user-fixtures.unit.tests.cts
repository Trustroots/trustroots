const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const crypto: typeof import('node:crypto') = require('node:crypto');
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

function fixture(username: string, password: string) {
  return {
    username,
    password,
    firstName: 'Sample',
    lastName: 'Member',
    email: `${username}@example.com`,
    provider: 'local',
  };
}

describe('Reusable user fixture passwords', () => {
  beforeEach(() => {
    sinon.stub(User.prototype, 'save').callsFake(runSaveMiddleware);
  });

  afterEach(() => sinon.restore());

  it('derives one real hash for repeated credentials and retains other save hooks', async () => {
    const derive = sinon.spy(crypto, 'scrypt');
    const input = [
      fixture('fixturefirst', 'RepeatedFixturePassword!'),
      fixture('fixturesecond', 'RepeatedFixturePassword!'),
    ];
    const users = await utils.saveUsersWithCachedPasswords(input);
    assert.equal(derive.callCount, 1);
    assert.equal(users[0].password, users[1].password);
    assert.match(users[0].password, /^\$scrypt\$/);
    assert.equal(input[0].password, 'RepeatedFixturePassword!');
    assert.equal(users[0].displayName, 'Sample Member');
    assert.equal(
      users[0].emailHash,
      crypto.createHash('md5').update(input[0].email).digest('hex'),
    );
    assert.equal(await users[0].authenticate(input[0].password), true);
    assert.equal(await users[1].authenticate('IncorrectPassword!'), false);
  });

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

  it('preserves an existing fixture document and its other save hooks', async () => {
    const user = utils.createTestUser(
      fixture('fixtureexisting', 'ExistingFixturePassword!'),
    );
    const saved = await utils.saveUserWithCachedPassword(user);
    assert.equal(saved, user);
    assert.equal(saved.displayName, 'Sample Member');
    assert.match(saved.password ?? '', /^\$scrypt\$/);
    assert.equal(await saved.authenticate('ExistingFixturePassword!'), true);
  });

  it('keeps different passwords separate', async () => {
    const users = await utils.saveUsersWithCachedPasswords([
      fixture('fixturethird', 'SeparateFixturePasswordOne!'),
      fixture('fixturefourth', 'SeparateFixturePasswordTwo!'),
    ]);
    assert.notEqual(users[0].password, users[1].password);
    assert.equal(
      await users[1].authenticate('SeparateFixturePasswordOne!'),
      false,
    );
    assert.equal(
      await users[1].authenticate('SeparateFixturePasswordTwo!'),
      true,
    );
  });

  it('still hashes a later password change normally', async () => {
    const [user] = await utils.saveUsersWithCachedPasswords([
      fixture('fixturechange', 'OriginalFixturePassword!'),
    ]);
    user.password = 'ChangedFixturePassword!';
    await user.save();
    assert.equal(await user.authenticate('ChangedFixturePassword!'), true);
    assert.equal(await user.authenticate('OriginalFixturePassword!'), false);
  });

  it('leaves ordinary saveUsers hashing fresh for each user', async () => {
    const users = await utils.saveUsers([
      fixture('fixturerealfirst', 'UncachedFixturePassword!'),
      fixture('fixturerealsecond', 'UncachedFixturePassword!'),
    ]);
    assert.notEqual(users[0].password, users[1].password);
  });

  it('preserves callback results', async () => {
    const callback = sinon.spy();
    const users = await utils.saveUsersWithCachedPasswords(
      [fixture('fixturecallback', 'CallbackFixturePassword!')],
      callback,
    );
    sinon.assert.calledOnceWithExactly(callback, null, users);
  });

  it('rejects invalid plaintext credentials and forwards validation errors', async () => {
    const callback = sinon.spy();
    const derive = sinon.spy(crypto, 'scrypt');
    await assert.rejects(
      utils.saveUsersWithCachedPasswords(
        [fixture('fixtureinvalid', 'short')],
        callback,
      ),
      error => {
        assert.ok(error instanceof mongoose.Error.ValidationError);
        assert.ok(error.errors.password);
        sinon.assert.calledOnceWithExactly(callback, error);
        return true;
      },
    );
    sinon.assert.notCalled(derive);
  });
});
