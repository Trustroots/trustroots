const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const sinon = require('sinon');
require('../../../users/server/models/user.server.model.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');

// Exercise real validation and save middleware without a database connection.
function runSaveMiddleware() {
  return new Promise((resolve, reject) => {
    User.schema.s.hooks.execPre('save', this, [{}], error => {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function fixture(username, password) {
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
      fixture('fixture-first', 'RepeatedFixturePassword!'),
      fixture('fixture-second', 'RepeatedFixturePassword!'),
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

  it('keeps different passwords separate', async () => {
    const users = await utils.saveUsersWithCachedPasswords([
      fixture('fixture-third', 'SeparateFixturePasswordOne!'),
      fixture('fixture-fourth', 'SeparateFixturePasswordTwo!'),
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
      fixture('fixture-change', 'OriginalFixturePassword!'),
    ]);
    user.password = 'ChangedFixturePassword!';
    await user.save();
    assert.equal(await user.authenticate('ChangedFixturePassword!'), true);
    assert.equal(await user.authenticate('OriginalFixturePassword!'), false);
  });

  it('leaves ordinary saveUsers hashing fresh for each user', async () => {
    const users = await utils.saveUsers([
      fixture('fixture-real-first', 'UncachedFixturePassword!'),
      fixture('fixture-real-second', 'UncachedFixturePassword!'),
    ]);
    assert.notEqual(users[0].password, users[1].password);
  });

  it('preserves callback results', async () => {
    const callback = sinon.spy();
    const users = await utils.saveUsersWithCachedPasswords(
      [fixture('fixture-callback', 'CallbackFixturePassword!')],
      callback,
    );
    sinon.assert.calledOnceWithExactly(callback, null, users);
  });

  it('rejects invalid plaintext credentials and forwards validation errors', async () => {
    const callback = sinon.spy();
    const derive = sinon.spy(crypto, 'scrypt');
    await assert.rejects(
      utils.saveUsersWithCachedPasswords(
        [fixture('fixture-invalid', 'short')],
        callback,
      ),
      error => {
        assert.ok(error.errors.password);
        sinon.assert.calledOnceWithExactly(callback, error);
        return true;
      },
    );
    sinon.assert.notCalled(derive);
  });
});
