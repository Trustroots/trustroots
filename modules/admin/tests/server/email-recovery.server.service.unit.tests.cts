const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const recovery: typeof import('../../server/services/email-recovery.server.service.mts') = require('../../server/services/email-recovery.server.service.mts');
const config = require('../../../../config/config.mts');
const mail: Pick<
  typeof import('../../../core/server/services/email.server.service.mts'),
  'sendSignupEmailConfirmation' | 'sendMessagesUnread'
> = require('../../../core/server/services/email.server.service.mts');

type ObjectId = import('mongoose').Types.ObjectId;
type UnreadNotification = {
  notificationCount: number;
  messages: Array<{ content: string; created: Date }>;
};

const DAY = 86400000;
const MINUTE = 60000;

function utcDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

describe('Email recovery service', () => {
  const saved = {
    node: process.env.NODE_ENV,
    tier: process.env.TRUSTROOTS_DEPLOYMENT_TIER,
    mode: process.env.TRUSTROOTS_MAIL_MODE,
  };
  let original: { domain: string; options: unknown };
  const users = () => mongoose.connection.collection('users');
  const messages = () => mongoose.connection.collection('messages');
  const claims = () =>
    mongoose.connection.collection<{ _id: string; status: string }>(
      'emailRecovery',
    );
  let serial = 0;

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
    await claims().deleteMany({});
    await utils.clearDatabase();
  });

  function live() {
    process.env.NODE_ENV = 'production';
    process.env.TRUSTROOTS_DEPLOYMENT_TIER = 'production';
    process.env.TRUSTROOTS_MAIL_MODE = 'live';
    config.domain = 'www.trustroots.org';
    config.mailer.options = { host: 'smtp.example.test' };
  }

  /** Insert a raw member document; enough for listing, not for saving. */
  async function insertMember(fields: Record<string, unknown>) {
    serial += 1;
    const doc = {
      username: `rawmember${serial}`,
      email: `rawmember${serial}@example.test`,
      roles: ['user'],
      public: false,
      ...fields,
    };
    const { insertedId } = await users().insertOne(doc);
    return { ...doc, _id: insertedId };
  }

  /** Save members that the recovery can update and email. */
  async function saveMembers(count: number, isPublic = true) {
    const fixtures = utils.generateUsersWithSharedPassword(count);
    for (const fixture of fixtures) fixture.public = isPublic;
    return (await utils.saveUsersWithCachedPasswords(
      fixtures,
    )) as unknown as Array<{
      _id: ObjectId;
      username: string;
      email: string;
    }>;
  }

  async function insertMessage(fields: Record<string, unknown>) {
    const doc = {
      content: 'A fictional unread message.',
      read: false,
      shadowHidden: false,
      ...fields,
    };
    const { insertedId } = await messages().insertOne(doc);
    return insertedId;
  }

  function stubUnread() {
    return sinon
      .stub(mail, 'sendMessagesUnread')
      .callsFake(
        (
          _from: unknown,
          _to: unknown,
          _notification: unknown,
          done: (error?: Error) => void,
        ) => done(),
      );
  }
  function stubSignup(
    fails: (user: { username: string }) => boolean = () => false,
  ) {
    return sinon
      .stub(mail, 'sendSignupEmailConfirmation')
      .callsFake((user: unknown, done: (error?: Error) => void) =>
        done(
          fails(user as { username: string })
            ? new Error('Fictional queue failure')
            : undefined,
        ),
      );
  }

  describe('day and page input', () => {
    it('accepts only plain past or current UTC days', async () => {
      for (const day of [
        '-000001-01',
        '2026-02-30',
        20261030,
        ['2026-10-30'],
      ]) {
        await assert.rejects(recovery.recoveryDay(day), {
          message: 'Choose a valid past or current UTC day.',
        });
      }
      // Midnight today is the current day, not a future one.
      const today = Date.parse(utcDay(Date.now()));
      sinon.useFakeTimers({ now: today, toFake: ['Date'] });
      assert.equal((await recovery.recoveryDay(utcDay(today))).page, 1);
    });

    it('accepts recovery and account pages from 1 to 1000', async () => {
      const day = utcDay(Date.now() - 2 * DAY);
      const from = new Date(Date.now() - 2 * DAY).toISOString();
      const to = new Date(Date.now() - DAY).toISOString();
      for (const [list, message] of [
        [(page: string) => recovery.recoveryDay(day, page), 'recovery'],
        [
          (page: string) => recovery.recoveryAccounts(from, to, page),
          'account',
        ],
      ] as const) {
        for (const page of ['0', '1.5', '1001', 'x']) {
          await assert.rejects(list(page), {
            message: `Invalid ${message} page.`,
          });
        }
        assert.equal((await list('1000')).page, 1000);
      }
    });
  });

  describe('recoveryDay', () => {
    it('lists pending signups and the latest unread message of each conversation', async () => {
      const day = utcDay(Date.now() - 2 * DAY);
      const at = (hour: number) => new Date(Date.parse(day) + hour * 3600000);
      const [sender, recipient, otherRecipient, otherSender] =
        await saveMembers(4);
      const signup = await insertMember({
        created: at(10),
        emailTemporary: 'pending-signup@example.test',
      });
      for (const role of ['suspended', 'shadowban']) {
        await insertMember({
          created: at(9),
          emailTemporary: `${role}@example.test`,
          roles: ['user', role],
        });
      }
      await insertMessage({
        userFrom: sender._id,
        userTo: recipient._id,
        created: at(8),
      });
      // Two latest messages at the same time: the higher ID is the latest.
      const tiedLower = new mongoose.Types.ObjectId('6a0000000000000000000001');
      const tiedHigher = new mongoose.Types.ObjectId(
        '6a0000000000000000000002',
      );
      for (const _id of [tiedLower, tiedHigher]) {
        await insertMessage({
          _id,
          userFrom: sender._id,
          userTo: recipient._id,
          created: at(11),
        });
      }
      const sameSender = await insertMessage({
        userFrom: sender._id,
        userTo: otherRecipient._id,
        created: at(12),
      });
      const sameRecipient = await insertMessage({
        userFrom: otherSender._id,
        userTo: recipient._id,
        created: at(13),
      });
      await claims().insertOne({
        _id: `message:${sameSender}`,
        status: 'queued',
      });

      const reminder = (to: { username: string; email: string }) => ({
        kind: 'message',
        recipient: to.email,
        username: to.username,
      });
      assert.deepEqual(await recovery.recoveryDay(day), {
        page: 1,
        more: false,
        candidates: [
          {
            key: `signup:${signup._id}`,
            kind: 'signup',
            recipient: 'pending-signup@example.test',
            username: signup.username,
            description: 'Fresh sign-up confirmation',
          },
          {
            key: `message:${tiedHigher}`,
            ...reminder(recipient),
            description: `Unread-message reminder from @${sender.username}`,
          },
          {
            key: `message:${sameSender}`,
            ...reminder(otherRecipient),
            description: `Unread-message reminder from @${sender.username}`,
            status: 'queued',
          },
          {
            key: `message:${sameRecipient}`,
            ...reminder(recipient),
            description: `Unread-message reminder from @${otherSender.username}`,
          },
        ],
      });
    });

    it('pages 50 candidates and accounts at a time', async () => {
      const day = utcDay(Date.now() - 2 * DAY);
      const from = new Date(Date.parse(day) - DAY).toISOString();
      const to = new Date(Date.parse(day) + DAY).toISOString();
      for (let index = 0; index < 51; index += 1) {
        await insertMember({
          created: new Date(Date.parse(day) + index * MINUTE),
          emailTemporary: `pending${index}@example.test`,
        });
      }
      // [candidates on page 1, more, candidates on page 2, more] per list.
      const pages = async () => {
        const shapes = [];
        for (const list of [
          (page?: string) => recovery.recoveryDay(day, page),
          (page?: string) => recovery.recoveryAccounts(from, to, page),
        ]) {
          for (const { candidates, more } of [await list(), await list('2')])
            shapes.push(candidates.length, more);
        }
        return shapes;
      };
      assert.deepEqual(await pages(), [50, true, 1, false, 50, true, 1, false]);
      await users().deleteOne({ username: `rawmember${serial}` });
      assert.deepEqual(await pages(), [
        50,
        false,
        0,
        false,
        50,
        false,
        0,
        false,
      ]);
    });

    it('does not page over confirmed members or read messages', async () => {
      const day = utcDay(Date.now() - 2 * DAY);
      const created = new Date(Date.parse(day) + 3600000);
      for (let index = 0; index < 51; index += 1) {
        await insertMember({ created, public: true });
        await insertMessage({
          userFrom: new mongoose.Types.ObjectId(),
          userTo: new mongoose.Types.ObjectId(),
          created,
          read: true,
        });
      }
      assert.deepEqual(await recovery.recoveryDay(day), {
        candidates: [],
        more: false,
        page: 1,
      });
    });
  });

  describe('queueRecovery input', () => {
    const date = utcDay(Date.now() - 2 * DAY);
    const key = (index: number) =>
      'signup:' + index.toString(16).padStart(24, '0');
    const actor = new mongoose.Types.ObjectId();

    it('checks the day, then 1 to 50 distinct string keys, then live mail', async () => {
      const keys = (length: number) =>
        Array.from({ length }, (_, index) => key(index));
      const selection = 'Select between 1 and 50 distinct recovery emails.';
      for (const [day, selected, message] of [
        ['bad', [key(1)], 'Choose a valid past or current UTC day.'],
        [date, key(1), selection],
        [date, [], selection],
        [date, keys(51), selection],
        [date, [key(1), 5], selection],
        [date, [key(1), key(1)], selection],
        [date, keys(50), 'Recovery requires live production email sending.'],
      ] as const) {
        await assert.rejects(recovery.queueRecovery(day, selected, actor), {
          message,
        });
      }
    });

    it('requires a 24-character hexadecimal ID', async () => {
      live();
      const id = key(1).slice('signup:'.length);
      for (const bad of [`signup:x${id}`, `signup:${id}x`, 'signup']) {
        await assert.rejects(recovery.queueRecovery(date, [bad], actor), {
          message: 'Invalid recovery selection.',
        });
      }
    });
  });

  describe('queueRecovery of signups', () => {
    async function pending(
      overrides: { roles?: string[]; emailTemporary?: string } = {},
    ) {
      const created = new Date(Date.now() - 2 * DAY);
      const fixtures = utils.generateUsersWithSharedPassword(1);
      Object.assign(fixtures[0], {
        created,
        public: false,
        emailTemporary: fixtures[0].email,
        ...overrides,
      });
      const [user] = (await utils.saveUsersWithCachedPasswords(
        fixtures,
      )) as unknown as Array<{ _id: ObjectId; username: string }>;
      return {
        user,
        key: `signup:${user._id}`,
        date: utcDay(created.getTime()),
      };
    }

    it('skips restricted members and members without a pending address', async () => {
      live();
      const send = stubSignup();
      for (const overrides of [
        { roles: ['user', 'suspended'] },
        { emailTemporary: '' },
      ]) {
        const { key, date } = await pending(overrides);
        assert.deepEqual(
          await recovery.queueRecovery(
            date,
            [key],
            new mongoose.Types.ObjectId(),
          ),
          [{ key, status: 'No longer eligible' }],
        );
      }
      assert.equal(send.callCount, 0);
    });

    it('audits each request and records each outcome against its own claim', async () => {
      const failing = await pending();
      const working = await pending();
      live();
      stubSignup(user => user.username === failing.user.username);
      const actor = new mongoose.Types.ObjectId();
      assert.deepEqual(
        await recovery.queueRecovery(
          failing.date,
          [failing.key, working.key],
          actor,
        ),
        [
          {
            key: failing.key,
            status: 'Not confirmed queued; inspect before retrying',
          },
          { key: working.key, status: 'Queued for delivery' },
        ],
      );
      const statuses = Object.fromEntries(
        (await claims().find().toArray()).map(claim => [
          claim._id,
          claim.status,
        ]),
      );
      assert.deepEqual(statuses, {
        [failing.key]: 'uncertain',
        [working.key]: 'queued',
      });
      const audits = await mongoose
        .model<{
          user: ObjectId;
          route: string;
          body: Record<string, unknown>;
        }>('AuditLog')
        .find()
        .sort({ _id: 1 })
        .lean();
      assert.deepEqual(
        audits.map(audit => ({
          user: String(audit.user),
          route: audit.route,
          body: audit.body,
        })),
        [failing, working].map(({ key }) => ({
          user: String(actor),
          route: 'sparkpost/recovery',
          body: { key, date: failing.date },
        })),
      );
    });

    it('leaves the claim visible when its outcome cannot be recorded', async () => {
      const { key, date } = await pending();
      live();
      stubSignup();
      sinon
        .stub(claims(), 'updateOne')
        .rejects(new Error('Fictional storage outage'));
      await assert.rejects(
        recovery.queueRecovery(date, [key], new mongoose.Types.ObjectId()),
        /storage outage/,
      );
      sinon.restore();
      assert.equal((await claims().findOne({ _id: key }))?.status, 'claiming');
    });
  });

  describe('queueRecovery of unread messages', () => {
    let sender: { _id: ObjectId; username: string };
    let recipient: { _id: ObjectId; username: string };
    let bystander: { _id: ObjectId; username: string };
    const actor = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      [sender, recipient, bystander] = await saveMembers(3);
      // An older message elsewhere, first in natural order.
      await insertMessage({
        userFrom: bystander._id,
        userTo: sender._id,
        created: new Date(Date.now() - 2 * 3600000),
        read: true,
      });
    });

    async function queue(created: Date, fields: Record<string, unknown> = {}) {
      const id = await insertMessage({
        userFrom: sender._id,
        userTo: recipient._id,
        created,
        ...fields,
      });
      const key = `message:${id}`;
      const [result] = await recovery.queueRecovery(
        utcDay(created.getTime()),
        [key],
        actor,
      );
      assert.equal(result.key, key);
      return result.status;
    }
    const queued = 'Queued for delivery';
    const ineligible = 'No longer eligible';

    it('sends the unread conversation, newest first', async () => {
      live();
      const send = stubUnread();
      const older = new Date(Date.now() - 3 * 3600000);
      await insertMessage({
        userFrom: sender._id,
        userTo: recipient._id,
        created: older,
        content: 'An older fictional message.',
      });
      // A newer message in another conversation.
      await insertMessage({
        userFrom: bystander._id,
        userTo: recipient._id,
        created: new Date(Date.now() - 30 * MINUTE),
      });
      const latest = new Date(Date.now() - 2 * 3600000);
      assert.equal(await queue(latest), queued);
      const notification = send.firstCall.args[2] as UnreadNotification;
      assert.deepEqual(notification, {
        notificationCount: 1,
        messages: [
          { content: 'A fictional unread message.', created: latest },
          { content: 'An older fictional message.', created: older },
        ],
      });
    });

    it('selects only the latest unread message of the conversation', async () => {
      live();
      stubUnread();
      const created = new Date(Date.now() - 3600000);
      const lower = new mongoose.Types.ObjectId('6b0000000000000000000001');
      const higher = new mongoose.Types.ObjectId('6b0000000000000000000002');
      await insertMessage({
        _id: higher,
        userFrom: sender._id,
        userTo: recipient._id,
        created,
      });
      assert.equal(await queue(created, { _id: lower }), ineligible);
      await insertMessage({
        userFrom: sender._id,
        userTo: recipient._id,
        created: new Date(created.getTime() + MINUTE),
      });
      const [result] = await recovery.queueRecovery(
        utcDay(created.getTime()),
        [`message:${higher}`],
        actor,
      );
      assert.equal(result.status, ineligible);
    });

    it('requires both members to be public and unrestricted', async () => {
      live();
      const send = stubUnread();
      const created = new Date(Date.now() - 3600000);
      for (const [member, change] of [
        [recipient, { roles: ['user', 'suspended'] }],
        [sender, { roles: ['user', 'shadowban'] }],
        [recipient, { public: false }],
        [sender, { public: false }],
      ] as const) {
        await users().updateOne({ _id: member._id }, { $set: change });
        assert.equal(await queue(created), ineligible);
        await users().updateOne(
          { _id: member._id },
          { $set: { roles: ['user'], public: true } },
        );
      }
      assert.equal(send.callCount, 0);
    });

    it('allows blocks between other members and a missing block list', async () => {
      live();
      stubUnread();
      for (const blocked of [[bystander._id], null]) {
        await users().updateMany(
          { _id: { $in: [sender._id, recipient._id] } },
          { $set: { blocked } },
        );
        assert.equal(await queue(new Date(Date.now() - 3600000)), queued);
      }
    });

    it('allows up to 50 unread messages in the conversation', async () => {
      live();
      stubUnread();
      const start = Date.now() - 5 * 3600000;
      await messages().insertMany(
        Array.from({ length: 49 }, (_, index) => ({
          userFrom: sender._id,
          userTo: recipient._id,
          created: new Date(start + index * MINUTE),
          read: false,
        })),
      );
      assert.equal(await queue(new Date(Date.now() - 3600000)), queued);
      await claims().deleteMany({});
      await insertMessage({
        userFrom: sender._id,
        userTo: recipient._id,
        created: new Date(start - MINUTE),
      });
      const [result] = await recovery.queueRecovery(
        utcDay(Date.now() - 3600000),
        [
          `message:${
            (await messages().findOne(
              { userFrom: sender._id },
              { sort: { created: -1 } },
            ))!._id
          }`,
        ],
        actor,
      );
      assert.equal(result.status, ineligible);
    });

    it('waits ten minutes and gives up after 30 days', async () => {
      live();
      stubUnread();
      const now = Date.now();
      sinon.useFakeTimers({ now, toFake: ['Date'] });
      assert.equal(await queue(new Date(now - 10 * MINUTE)), queued);
      assert.equal(await queue(new Date(now - 10 * MINUTE + 1)), ineligible);
      await messages().deleteMany({ userFrom: sender._id });
      assert.equal(await queue(new Date(now - 5 * MINUTE)), ineligible);
      await messages().deleteMany({ userFrom: sender._id });
      assert.equal(await queue(new Date(now - 30 * DAY)), queued);
      await messages().deleteMany({ userFrom: sender._id });
      assert.equal(await queue(new Date(now - 30 * DAY - 1)), ineligible);
    });
  });

  describe('recoveryAccounts', () => {
    const base = Date.now() - 5 * DAY;
    const from = new Date(base - DAY).toISOString();
    const to = new Date(base + DAY).toISOString();

    it('lists unconfirmed, unrestricted signups in the window in creation order', async () => {
      const later = await insertMember({
        created: new Date(base + 3600000),
        emailTemporary: 'later-pending@example.test',
      });
      const earlier = await insertMember({ created: new Date(base) });
      await insertMember({ created: new Date(base), public: true });
      await insertMember({
        created: new Date(base),
        roles: ['user', 'shadowban'],
      });
      await insertMember({ created: new Date(base - 3 * DAY) });
      await claims().insertOne({
        _id: `signup:${later._id}`,
        status: 'queued',
      });
      const signup = (member: typeof later) => ({
        key: `signup:${member._id}`,
        kind: 'signup',
        username: member.username,
        description: 'Fresh sign-up confirmation',
        created: (member as unknown as { created: Date }).created.toISOString(),
      });
      assert.deepEqual(await recovery.recoveryAccounts(from, to), {
        page: 1,
        more: false,
        candidates: [
          {
            ...signup(earlier),
            recipient: earlier.email,
            status: 'No pending confirmation address',
          },
          {
            ...signup(later),
            recipient: 'later-pending@example.test',
            status: 'queued',
          },
        ],
      });
    });
  });
});
