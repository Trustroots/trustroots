const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const utils = require('../../../../testutils/server/data.server.testutil');
const recovery: typeof import('../../server/services/email-recovery.server.service.mts') = require('../../server/services/email-recovery.server.service.mts');
const config = require('../../../../config/config.mts');
const mail: Pick<
  typeof import('../../../core/server/services/email.server.service.mts'),
  'sendSignupEmailConfirmation' | 'sendMessagesUnread'
> = require('../../../core/server/services/email.server.service.mts');
describe('Daily selected email recovery', () => {
  const saved = {
    node: process.env.NODE_ENV,
    tier: process.env.TRUSTROOTS_DEPLOYMENT_TIER,
    mode: process.env.TRUSTROOTS_MAIL_MODE,
  };
  let original: { domain: string; options: unknown };
  beforeEach(() => {
    original = { domain: config.domain, options: config.mailer.options };
  });
  afterEach(async () => {
    sinon.restore();
    config.domain = original.domain;
    config.mailer.options = original.options;
    for (const [name, value] of Object.entries({
      NODE_ENV: saved.node,
      TRUSTROOTS_DEPLOYMENT_TIER: saved.tier,
      TRUSTROOTS_MAIL_MODE: saved.mode,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await mongoose.connection.collection('emailRecovery').deleteMany({});
    await utils.clearDatabase();
  });
  function live() {
    process.env.NODE_ENV = 'production';
    process.env.TRUSTROOTS_DEPLOYMENT_TIER = 'production';
    process.env.TRUSTROOTS_MAIL_MODE = 'live';
    config.domain = 'www.trustroots.org';
    config.mailer.options = { host: 'smtp.example.test' };
  }
  it('previews and queues a fresh confirmation exactly once across repeated submissions', async () => {
    const users = utils.generateUsers(1);
    users[0].created = new Date('2026-10-30T12:00:00Z');
    users[0].public = false;
    users[0].emailTemporary = users[0].email;
    await utils.saveUsers(users);
    const day = await recovery.recoveryDay('2026-10-30');
    assert.equal(day.candidates.length, 1);
    const key = day.candidates[0].key;
    const send = sinon
      .stub(mail, 'sendSignupEmailConfirmation')
      .callsFake((_user, done) => done());
    live();
    const actor = new mongoose.Types.ObjectId();
    const result = await recovery.queueRecovery('2026-10-30', [key], actor);
    assert.equal(result[0].status, 'Queued for delivery');
    const repeat = await recovery.queueRecovery('2026-10-30', [key], actor);
    assert.match(repeat[0].status, /Already handled/);
    assert.equal(send.callCount, 1);
    assert.equal(
      (
        await recovery.recoveryAccounts(
          '2026-10-28T00:00:00.000Z',
          '2026-10-31T12:00:00.000Z',
        )
      ).candidates[0].status,
      'queued',
    );
    const user = await mongoose.connection
      .collection('users')
      .findOne({ username: users[0].username });
    assert.ok(user!.emailTokenExpires > new Date());
    assert.equal(
      (await recovery.recoveryDay('2026-10-30')).candidates[0].status,
      'queued',
    );
  });
  it('rejects invalid selection and non-live mail without claiming or sending', async () => {
    await assert.rejects(recovery.recoveryDay('bad'));
    await assert.rejects(recovery.recoveryDay('2026-10-30', '0'));
    await assert.rejects(
      recovery.queueRecovery('2026-10-30', [], new mongoose.Types.ObjectId()),
    );
    await assert.rejects(
      recovery.queueRecovery(
        '2026-10-30',
        ['signup:000000000000000000000000'],
        new mongoose.Types.ObjectId(),
      ),
      /live production/,
    );
    assert.equal(
      await mongoose.connection.collection('emailRecovery').countDocuments(),
      0,
    );
  });
  it('queues only current unread conversations and excludes read, replied and restricted accounts', async () => {
    const users = utils.generateUsers(2);
    users.forEach((user: { public: boolean }) => {
      user.public = true;
    });
    await utils.saveUsers(users);
    const from = await mongoose.connection
      .collection('users')
      .findOne({ username: users[0].username });
    const to = await mongoose.connection
      .collection('users')
      .findOne({ username: users[1].username });
    const created = new Date(Date.now() - 3600000);
    const day = created.toISOString().slice(0, 10);
    const messages = mongoose.connection.collection('messages');
    const inserted = await messages.insertOne({
      userFrom: from!._id,
      userTo: to!._id,
      created,
      read: false,
      shadowHidden: false,
      content: 'A fictional unread message.',
    });
    const key = 'message:' + inserted.insertedId;
    const candidates = await recovery.recoveryDay(day);
    assert.ok(candidates.candidates.some(row => row.key === key));
    const send = sinon
      .stub(mail, 'sendMessagesUnread')
      .callsFake(
        (
          _from: unknown,
          _to: unknown,
          _notification: unknown,
          done: (error?: Error) => void,
        ) => done(),
      );
    live();
    assert.equal(
      (await recovery.queueRecovery(day, [key], from!._id))[0].status,
      'Queued for delivery',
    );
    assert.equal(send.callCount, 1);
    await messages.updateOne(
      { _id: inserted.insertedId },
      { $set: { read: true } },
    );
    assert.equal(
      (await recovery.queueRecovery(day, [key], from!._id))[0].status,
      'No longer eligible',
    );
    await messages.updateOne(
      { _id: inserted.insertedId },
      { $set: { read: false } },
    );
    await messages.insertOne({
      userFrom: to!._id,
      userTo: from!._id,
      created: new Date(),
      content: 'A fictional reply.',
    });
    assert.equal((await recovery.recoveryDay(day)).candidates.length, 0);
  });
  it('shows accounts across the selected window and preserves uncertain claims after queue errors', async () => {
    const users = utils.generateUsers(1);
    users[0].created = new Date('2026-10-30T12:00:00Z');
    users[0].public = false;
    users[0].emailTemporary = users[0].email;
    await utils.saveUsers(users);
    const accounts = await recovery.recoveryAccounts(
      '2026-10-28T00:00:00.000Z',
      '2026-10-31T12:00:00.000Z',
    );
    assert.equal(accounts.candidates[0].username, users[0].username);
    const key = accounts.candidates[0].key;
    sinon
      .stub(mail, 'sendSignupEmailConfirmation')
      .callsFake((_user, done) => done(new Error('Fictional queue failure')));
    live();
    const actor = new mongoose.Types.ObjectId();
    assert.match(
      (await recovery.queueRecovery('2026-10-30', [key], actor))[0].status,
      /Not confirmed queued/,
    );
    assert.match(
      (await recovery.queueRecovery('2026-10-30', [key], actor))[0].status,
      /Already handled/,
    );
    await assert.rejects(recovery.recoveryAccounts('bad', 'bad'));
    await assert.rejects(
      recovery.recoveryAccounts(
        '2026-10-28T00:00:00.000Z',
        '2026-10-31T12:00:00.000Z',
        '0',
      ),
    );
  });
  it('rejects malformed recovery IDs and skips deleted or read message events', async () => {
    live();
    const actor = new mongoose.Types.ObjectId();
    for (const key of [
      'bad',
      'signup:',
      'signup:bad',
      'other:000000000000000000000000',
    ])
      await assert.rejects(recovery.queueRecovery('2026-10-30', [key], actor));
    assert.equal(
      (
        await recovery.queueRecovery(
          '2026-10-30',
          ['message:000000000000000000000000'],
          actor,
        )
      )[0].status,
      'No longer eligible',
    );
  });
  it('checks blocking in both directions and preserves uncertain message outcomes', async () => {
    const users = utils.generateUsers(2);
    users.forEach((user: { public: boolean }) => {
      user.public = true;
    });
    await utils.saveUsers(users);
    const collection = mongoose.connection.collection('users');
    const sender = (await collection.findOne({ username: users[0].username }))!;
    const recipient = (await collection.findOne({
      username: users[1].username,
    }))!;
    const created = new Date(Date.now() - 3600000);
    const day = created.toISOString().slice(0, 10);
    const message = await mongoose.connection.collection('messages').insertOne({
      userFrom: sender._id,
      userTo: recipient._id,
      created,
      read: false,
      content: 'Fictional unread content.',
    });
    live();
    const key = 'message:' + message.insertedId;
    await collection.updateOne(
      { _id: recipient._id },
      { $set: { blocked: [sender._id] } },
    );
    assert.equal(
      (await recovery.queueRecovery(day, [key], sender._id))[0].status,
      'No longer eligible',
    );
    await collection.updateOne(
      { _id: recipient._id },
      { $set: { blocked: [] } },
    );
    await collection.updateOne(
      { _id: sender._id },
      { $set: { blocked: [recipient._id] } },
    );
    assert.equal(
      (await recovery.queueRecovery(day, [key], sender._id))[0].status,
      'No longer eligible',
    );
    await collection.updateOne({ _id: sender._id }, { $set: { blocked: [] } });
    sinon
      .stub(mail, 'sendMessagesUnread')
      .callsFake(
        (
          _from: unknown,
          _to: unknown,
          _notification: unknown,
          done: (error?: Error) => void,
        ) => done(new Error('Fictional failure')),
      );
    assert.match(
      (await recovery.queueRecovery(day, [key], sender._id))[0].status,
      /Not confirmed queued/,
    );
  });
  it('lists accounts without pending addresses but does not queue them, and propagates storage errors before sending', async () => {
    const users = utils.generateUsers(1);
    users[0].created = new Date('2026-10-30T12:00:00Z');
    users[0].public = false;
    users[0].emailTemporary = users[0].email;
    await utils.saveUsers(users);
    const user = (await mongoose.connection
      .collection('users')
      .findOne({ username: users[0].username }))!;
    const key = 'signup:' + user._id;
    live();
    const claims = mongoose.connection.collection('emailRecovery');
    const insert = sinon
      .stub(claims, 'insertOne')
      .rejects(new Error('Fictional storage outage'));
    await assert.rejects(
      recovery.queueRecovery('2026-10-30', [key], user._id),
      /storage outage/,
    );
    insert.restore();
    await mongoose.connection
      .collection('users')
      .updateOne({ _id: user._id }, { $unset: { emailTemporary: 1 } });
    const result = await recovery.recoveryAccounts(
      '2026-10-28T00:00:00.000Z',
      '2026-10-31T12:00:00.000Z',
    );
    assert.equal(
      result.candidates[0].status,
      'No pending confirmation address',
    );
    assert.equal(result.candidates[0].recipient, users[0].email.toLowerCase());
    assert.equal(
      (await recovery.queueRecovery('2026-10-30', [key], user._id))[0].status,
      'No longer eligible',
    );
  });
  it('protects the send handler and returns safe storage failures', async () => {
    const controller: typeof import('../../server/controllers/admin.sparkpost.server.controller.mts') = require('../../server/controllers/admin.sparkpost.server.controller.mts');
    let status = 200;
    const response = {
      set() {},
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        return body;
      },
    };
    await controller.recover({} as never, response as never);
    assert.equal(status, 403);
    const actor = new mongoose.Types.ObjectId();
    await controller.recover(
      { user: { _id: actor, roles: ['user'] } } as never,
      response as never,
    );
    assert.equal(status, 403);
    await controller.recover(
      { user: { _id: actor, roles: ['admin'] } } as never,
      response as never,
    );
    assert.equal(status, 400);
    live();
    sinon
      .stub(mongoose.model('User'), 'findOne')
      .rejects(new Error('Fictional private failure'));
    const result = await controller.recover(
      {
        user: { _id: actor, roles: ['admin'] },
        body: { date: '2026-10-30', keys: ['signup:000000000000000000000000'] },
      } as never,
      response as never,
    );
    assert.equal(status, 503);
    assert.ok(!JSON.stringify(result).includes('private failure'));
  });
});
