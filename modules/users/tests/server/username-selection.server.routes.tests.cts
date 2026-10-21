import type {
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const should: typeof import('should') = require('should');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: typeof import('../../../../config/lib/express.mjs').default = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  should.exist(value);
  if (value === null || value === undefined) throw new Error('Expected a user');
}

async function findUser(
  id: import('mongoose').Types.ObjectId | string,
): Promise<
  import('../../../../testutils/server/model-contracts.mts').UserModelDocument
> {
  const user = await User.findById(id);
  assertPresent(user);
  return user;
}
const formatMessage =
  'Use 3–34 letters and numbers, including at least one letter.';
const npub = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';

function member(): import('../../../../testutils/common/data.common.testutil.mts').ServerUserFixture & {
  provider: string;
  nostrNpub: string;
} {
  return {
    firstName: 'Amina',
    lastName: 'Vale',
    username: 'samplemember',
    email: 'sample@example.org',
    password: 'Password123!',
    public: true,
    nostrNpub: npub,
    languages: [],
    roles: ['user'],
    provider: 'local',
  };
}

describe('Username selection and existing identities', function () {
  let app: Awaited<ReturnType<typeof express.init>>;
  testutils.catchJobs();
  before(async function () {
    app = await express.init(mongoose.connection);
  });
  afterEach(utils.clearDatabase);

  for (const username of [
    'sample_member',
    'sample-member',
    'sample.member',
    'Ken42',
    '123456',
    'ab',
    'a'.repeat(35),
  ]) {
    it('rejects selection consistently: ' + username, async function () {
      const signup = await request(app)
        .post('/api/auth/signup')
        .send({ ...member(), ageConfirmed: true, username })
        .expect(400);
      signup.body.message.should.equal(formatMessage);
      const validation = await request(app)
        .post('/api/auth/signup/validate')
        .send({ username })
        .expect(200);
      validation.body.valid.should.be.false();
      validation.body.message.should.equal(formatMessage);
      const [user] = await utils.saveUsers([member()]);
      const agent = request.agent(app);
      await utils.signIn(member(), agent);
      const response = await agent
        .put('/api/users')
        .send({ username })
        .expect(400);
      response.body.message.should.equal(formatMessage);
      const saved = await findUser(user._id);
      saved.username.should.equal(member().username);
      should.not.exist(saved.usernameUpdated);
    });
  }

  for (const username of [null, false, 0, true, 12345, [], ['member'], {}]) {
    it(
      'rejects non-string API input: ' + JSON.stringify(username),
      async function () {
        await request(app)
          .post('/api/auth/signup')
          .send({ ...member(), ageConfirmed: true, username })
          .expect(400);
        const validation = await request(app)
          .post('/api/auth/signup/validate')
          .send({ username })
          .expect(400);
        validation.body.valid.should.be.false();
        const [user] = await utils.saveUsers([member()]);
        const agent = request.agent(app);
        await utils.signIn(member(), agent);
        await agent.put('/api/users').send({ username }).expect(400);
        const saved = await findUser(user._id);
        saved.username.should.equal(member().username);
        should.not.exist(saved.usernameUpdated);
      },
    );
  }

  for (const username of [
    'legacy_member',
    'legacy-member',
    'legacy.member',
    '123456',
    'nostr',
  ]) {
    it('preserves the existing identity ' + username, async function () {
      const [user] = await utils.saveUsers([member()]);
      // Simulate an account created before the new policy without weakening new-record validation.
      await User.collection.updateOne(
        { _id: user._id },
        { $set: { username } },
      );
      const agent = request.agent(app);
      await utils.signIn({ ...member(), username }, agent);
      await agent.get('/api/users/' + username).expect(200);
      const lookup = await agent
        .get('/.well-known/nostr.json?name=' + username)
        .expect(200);
      lookup.body.names[username].should.equal('0'.repeat(64));
      for (const body of [
        { lastName: 'River' },
        { username: ' ' + username.toUpperCase() + ' ', lastName: 'River' },
      ]) {
        await agent.put('/api/users').send(body).expect(200);
        const saved = await findUser(user._id);
        saved.username.should.equal(username);
        saved.lastName.should.equal('River');
        should.not.exist(saved.usernameUpdated);
      }
      const saved = await findUser(user._id);
      saved.firstName = 'Mira';
      await saved.save();
      saved.username = 'another_member';
      const usernameError = saved.validateSync()?.errors.username;
      assertPresent(usernameError);
      await User.collection.updateOne(
        { _id: user._id },
        { $set: { public: false } },
      );
      (
        await agent.get('/.well-known/nostr.json?name=' + username).expect(200)
      ).body.names.should.deepEqual({});
    });
  }

  it('normalises an actual change and enforces its cooldown', async function () {
    const [user] = await utils.saveUsers([member()]);
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { created: new Date('2020-01-01') } },
    );
    const agent = request.agent(app);
    await utils.signIn(member(), agent);
    const changed = await agent
      .put('/api/users')
      .send({ username: ' NewMember42 ' })
      .expect(200);
    changed.body.username.should.equal('newmember42');
    should.not.exist(changed.body.usernameHistory);
    const first = await findUser(user._id);
    assertPresent(first.usernameUpdated);
    await agent
      .put('/api/users')
      .send({ username: ' NEWMEMBER42 ', lastName: 'River' })
      .expect(200);
    await agent
      .put('/api/users')
      .send({ username: 'anothermember42' })
      .expect(403);
    const saved = await findUser(user._id);
    saved.username.should.equal(first.username);
    const savedUsernameUpdated = saved.usernameUpdated;
    const firstUsernameUpdated = first.usernameUpdated;
    assertPresent(savedUsernameUpdated);
    assertPresent(firstUsernameUpdated);
    savedUsernameUpdated.getTime().should.equal(firstUsernameUpdated.getTime());

    // A successful later rename appends to the same persisted history.
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { usernameUpdated: new Date('2020-01-01') } },
    );
    await agent
      .put('/api/users')
      .send({ username: 'thirdmember42' })
      .expect(200);
    const historyOwner = await User.findById(user._id).select(
      '+usernameHistory',
    );
    assertPresent(historyOwner);
    historyOwner
      .usernameHistory!.map(({ oldUsername, newUsername }) => ({
        oldUsername,
        newUsername,
      }))
      .should.deepEqual([
        { oldUsername: 'samplemember', newUsername: 'newmember42' },
        { oldUsername: 'newmember42', newUsername: 'thirdmember42' },
      ]);
    historyOwner
      .usernameHistory!.every(entry => entry.changedAt instanceof Date)
      .should.be.true();
  });

  it('rejects reserved username changes before changing the timestamp', async function () {
    const [user] = await utils.saveUsers([member()]);
    const agent = request.agent(app);
    await utils.signIn(member(), agent);
    const response = await agent
      .put('/api/users')
      .send({ username: 'nostr' })
      .expect(400);
    response.body.message.should.equal('Username is not available.');
    const saved = await User.findById(user._id).select('+usernameHistory');
    assertPresent(saved);
    should.not.exist(saved.usernameUpdated);
    (saved.usernameHistory || []).length.should.equal(0);
  });
});
