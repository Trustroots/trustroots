import should from 'should';
import request from 'supertest';
import mongoose from 'mongoose';
import express from '../../../../config/lib/express.mts';
import config from '../../../../config/config.mts';
import defaults from '../../../../config/env/default.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import * as testutils from '../../../../testutils/server/server.testutil.mts';
import type {
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const User = mongoose.model<UserRecord, UserModel>('User');
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  should.exist(value);
  if (value === null || value === undefined)
    throw new Error('Expected a value');
}
function present<T>(value: T | null | undefined): T {
  assertPresent(value);
  return value;
}
const reservedNames = [
  'about',
  'abuse',
  'contact',
  'contacts',
  'contribute',
  'faq',
  'foundation',
  'help',
  'hosting',
  'inbox',
  'legal',
  'media',
  'messages',
  'nip05',
  'nostr',
  'npub',
  'nsec',
  'offer',
  'offers',
  'privacy',
  'relay',
  'rules',
  'safety',
  'search',
  'staff',
  'statistics',
  'team',
  'volunteering',
];
function member(): import('../../../../testutils/common/data.common.testutil.mts').ServerUserFixture & {
  provider: string;
} {
  return {
    firstName: 'Amina',
    lastName: 'Vale',
    username: 'samplemember',
    email: 'sample-member@example.org',
    password: 'M3@n.jsI$Aw3$0m3',
    provider: 'local',
    public: true,
    languages: [],
    roles: ['user'],
  };
}
describe('Account validation safeguards', function () {
  let app: Awaited<ReturnType<typeof express.init>>;
  const jobs = testutils.catchJobs();
  before(async function () {
    app = await express.init(mongoose.connection);
  });
  afterEach(utils.clearDatabase);
  for (const username of reservedNames) {
    it(
      'reserves ' + username + ' in configuration and signup',
      async function () {
        defaults.illegalStrings.should.containEql(username);
        config.illegalStrings.should.containEql(username);
        const validation = await request(app)
          .post('/api/auth/signup/validate')
          .send({
            username,
          })
          .expect(200);
        validation.body.valid.should.be.false();
        validation.body.message.should.equal('Username is not available.');
        await request(app)
          .post('/api/auth/signup')
          .send({
            ageConfirmed: true,
            ...member(),
            username,
          })
          .expect(400);
        should.not.exist(
          await User.findOne({
            username,
          }),
        );
      },
    );
  }
  it('preserves profile changes for an existing reserved username', async function () {
    const [user] = await utils.saveUsers([member()]);
    await User.updateOne(
      {
        _id: user._id,
      },
      {
        $set: {
          username: 'nostr',
        },
      },
    );
    const agent = request.agent(app);
    await utils.signIn(
      {
        ...member(),
        username: 'nostr',
      },
      agent,
    );
    for (const body of [
      {
        lastName: 'River',
      },
      {
        username: 'nostr',
        lastName: 'River',
      },
    ]) {
      await agent.put('/api/users').send(body).expect(200);
      const saved = await User.findById(user._id);
      assertPresent(saved);
      saved.username.should.equal('nostr');
      saved.lastName.should.equal('River');
    }
  });
  for (const email of [
    'member@example.org extra',
    {},
    [],
    42,
    0,
    false,
    null,
  ]) {
    it(
      'rejects invalid profile email ' + JSON.stringify(email),
      async function () {
        const [user] = await utils.saveUsers([member()]);
        const agent = request.agent(app);
        await utils.signIn(member(), agent);
        const response = await agent
          .put('/api/users')
          .send({
            email,
          })
          .expect(400);
        response.body.message.should.equal(
          'Please enter a valid email address.',
        );
        const saved = await User.findById(user._id);
        assertPresent(saved);
        saved.email.should.equal(member().email);
        present(saved.emailTemporary).should.equal('');
      },
    );
  }
  it('keeps an empty email update as an unchanged email', async function () {
    const [user] = await utils.saveUsers([member()]);
    const agent = request.agent(app);
    await utils.signIn(member(), agent);
    await agent
      .put('/api/users')
      .send({
        email: '',
      })
      .expect(200);
    const saved = await User.findById(user._id);
    assertPresent(saved);
    saved.email.should.equal(member().email);
  });
  for (const step of ['first', 'second', 'third']) {
    it(
      'acknowledges the disabled ' +
        step +
        ' welcome job without sending email',
      async function () {
        const handler = (
          await import(
            '../../server/jobs/user-welcome-sequence-' +
              step +
              '.server.job.mjs'
          )
        ).default;
        let calls = 0;
        const jobCount = jobs.length;
        handler({}, function (err: Error | null) {
          should.not.exist(err);
          calls += 1;
        });
        calls.should.equal(1);
        handler({});
        handler({}, null);
        jobs.length.should.equal(jobCount);
      },
    );
  }
});
