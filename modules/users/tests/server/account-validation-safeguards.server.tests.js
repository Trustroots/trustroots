const should = require('should');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const config = require('../../../../config/config');
const defaults = require('../../../../config/env/default');
const utils = require('../../../../testutils/server/data.server.testutil');
const testutils = require('../../../../testutils/server/server.testutil');
const User = mongoose.model('User');

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

function member() {
  return {
    firstName: 'Amina',
    lastName: 'Vale',
    username: 'samplemember',
    email: 'sample-member@example.org',
    password: 'M3@n.jsI$Aw3$0m3',
    provider: 'local',
    public: true,
  };
}

describe('Account validation safeguards', function () {
  let app;
  const jobs = testutils.catchJobs();
  before(function () {
    app = express.init(mongoose.connection);
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
          .send({ username })
          .expect(200);
        validation.body.valid.should.be.false();
        validation.body.message.should.equal('Username is not available.');
        await request(app)
          .post('/api/auth/signup')
          .send({ ...member(), username })
          .expect(400);
        should.not.exist(await User.findOne({ username }));
      },
    );
  }

  it('rejects profile changes for an existing reserved username', async function () {
    const [user] = await utils.saveUsers([member()]);
    await User.updateOne({ _id: user._id }, { $set: { username: 'nostr' } });
    const agent = request.agent(app);
    await utils.signIn({ ...member(), username: 'nostr' }, agent);
    for (const body of [
      { lastName: 'River' },
      { username: 'nostr', lastName: 'River' },
    ]) {
      await agent.put('/api/users').send(body).expect(400);
      const saved = await User.findById(user._id);
      saved.username.should.equal('nostr');
      saved.lastName.should.equal(member().lastName);
    }
  });

  it('rejects changing an existing username to a reserved name', async function () {
    const [user] = await utils.saveUsers([member()]);
    user.username = 'nostr';
    const error = user.validateSync();
    should.exist(error.errors.username);
  });

  for (const email of [
    'member@example.org extra',
    'two@@example.org',
    'plain-text',
  ]) {
    it('rejects malformed pending email ' + email, function () {
      const user = new User({ ...member(), emailTemporary: email });
      user
        .validateSync()
        .errors.emailTemporary.message.should.equal(
          'Please enter a valid email address.',
        );
    });
  }

  for (const emailTemporary of ['', 'member+confirmation@example.org']) {
    it(
      'allows valid or empty pending email ' + emailTemporary,
      async function () {
        const user = new User({ ...member(), emailTemporary });
        await user.save();
        user.emailTemporary.should.equal(emailTemporary);
      },
    );
  }

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
          .send({ email })
          .expect(400);
        response.body.message.should.equal(
          'Please enter a valid email address.',
        );
        const saved = await User.findById(user._id);
        saved.email.should.equal(member().email);
        saved.emailTemporary.should.equal('');
      },
    );
  }

  it('keeps an empty email update as an unchanged email', async function () {
    const [user] = await utils.saveUsers([member()]);
    const agent = request.agent(app);
    await utils.signIn(member(), agent);
    await agent.put('/api/users').send({ email: '' }).expect(200);
    (await User.findById(user._id)).email.should.equal(member().email);
  });

  for (const step of ['first', 'second', 'third']) {
    it(
      'acknowledges the disabled ' +
        step +
        ' welcome job without sending email',
      function () {
        const handler = require('../../server/jobs/user-welcome-sequence-' +
          step +
          '.server.job');
        let calls = 0;
        const jobCount = jobs.length;
        handler({}, function (err) {
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
