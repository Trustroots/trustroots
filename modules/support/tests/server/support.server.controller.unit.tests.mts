import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import sinon from 'sinon';
import winston from 'winston';
import config from '../../../../config/config.mts';
import emailService from '../../../core/server/services/email.server.service.mts';
import statsService from '../../../stats/server/services/stats.server.service.mts';
import '../../server/models/support.server.model.mts';
import agenda from '../../../../config/lib/agenda.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import controller from '../../server/controllers/support.server.controller.mts';
import { SUPPORT_CATEGORIES } from '../../shared/categories.ts';

const User = mongoose.model('User');
const SupportRequest = mongoose.model('SupportRequest');
const originalInbox = { ...config.supportInbox };

type Body = Record<string, unknown>;

type Reply = {
  statusCode: number;
  body: unknown;
  status(code: number): Reply;
  send(body: unknown): Reply;
  json(body: unknown): Reply;
};

function reply() {
  const result: Reply = {
    statusCode: 200,
    body: undefined,
    status(code) {
      result.statusCode = code;
      return result;
    },
    send(body) {
      result.body = body;
      return result;
    },
    json: body => result.send(body),
  };
  return result;
}

const GUEST = { message: 'Hi', email: 'guest@example.org' };
const member = () => ({
  _id: new mongoose.Types.ObjectId(),
  username: 'reporter',
  email: 'reporter@example.org',
  displayName: 'Reporter',
  created: new Date('2025-01-01T00:00:00Z'),
});

describe('Support controller', () => {
  let saved: Array<Record<string, unknown>>;
  let email: sinon.SinonStub;
  let stat: sinon.SinonStub;
  let log: sinon.SinonStub;

  beforeEach(() => {
    saved = [];
    sinon.stub(SupportRequest.prototype, 'save').callsFake(function (
      this: Record<string, unknown>,
    ) {
      saved.push(this);
      return Promise.resolve(this) as never;
    });
    email = sinon
      .stub(emailService, 'sendSupportRequest')
      .callsFake((_replyTo, _data, callback) => callback!(null));
    stat = sinon
      .stub(statsService, 'stat')
      .callsFake((_point, callback) => callback!());
    log = sinon.stub(winston.Logger.prototype, 'log');
    config.supportInbox.enabled = false;
    sinon.stub(config, 'supportEmail').value('support@example.test');
  });

  afterEach(() => {
    sinon.restore();
    Object.assign(config.supportInbox, originalInbox);
  });

  async function submit(
    body: Body,
    user?: ReturnType<typeof member>,
    req = {},
  ) {
    const res = reply();
    await controller.supportRequest(
      { body, headers: {}, user, ...req } as never,
      res as never,
    );
    return res;
  }

  /** Asserts the response status code and its `{ message }` body. */
  function answered(res: Reply, statusCode: number, message: string) {
    assert.deepEqual(
      { statusCode: res.statusCode, body: res.body },
      { statusCode, body: { message } },
    );
  }

  const BUILD = {
    committedAt: '2026-06-21 18:06',
    commitUrl:
      'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
    shortCommit: '7a1d639',
  };
  const HELP = {
    message: 'Need help',
    email: 'guest@example.com',
    username: 'guest',
  };
  const AGENT = { headers: { 'user-agent': 'TestAgent' } };
  const stored = (index = 0) =>
    Object.fromEntries(
      [
        'category',
        'email',
        'message',
        'reportMember',
        'user',
        'userAgent',
        'username',
      ]
        .map(key => [key, saved[index][key]])
        .filter(([, value]) => value !== undefined),
    );
  const saveWith = (outcome: () => Promise<never>) =>
    (SupportRequest.prototype.save as sinon.SinonStub).callsFake(outcome);

  it('sends a guest support request and records normal guest stats', async () => {
    const res = await submit(HELP, undefined, AGENT);
    answered(res, 200, 'Support request sent.');
    assert.equal(email.callCount, 1);
    const [replyTo, data] = email.firstCall.args;
    assert.deepEqual(replyTo, { address: 'guest@example.com' });
    assert.equal(data.categoryLabel, 'Other');
    assert.partialDeepStrictEqual(data, {
      authenticated: 'no',
      displayName: '-',
      email: 'guest@example.com',
      emailTemp: false,
      message: 'Need help',
      profilePublic: 'no',
      reportMember: false,
      signupDate: '-',
      userAgent: 'TestAgent',
      userId: '-',
      username: 'guest',
    });
    assert.deepEqual(stored(), {
      category: 'other',
      email: 'guest@example.com',
      message: 'Need help',
      userAgent: 'TestAgent',
      username: 'guest',
    });
  });

  it('adds build metadata to the support email data', async () => {
    await submit(HELP, undefined, {
      ...AGENT,
      app: { locals: { appSettings: { build: BUILD } } },
    });
    assert.deepEqual(email.firstCall.args[1].build, BUILD);
  });

  it('falls back to support email for invalid guest reply-to addresses', async () => {
    await submit({ email: 'not an email', username: 'guest' });
    const [replyTo, data] = email.firstCall.args;
    assert.deepEqual(replyTo, { address: 'support@example.test' });
    assert.equal(data.message, '—');
    assert.equal(data.userAgent, '—');
  });

  it('uses signed-in user data for reply-to, storage, and stats', async () => {
    sinon.stub(User, 'findOne').returns({
      select: async () => ({ _id: new mongoose.Types.ObjectId() }),
    } as never);
    const user = {
      ...member(),
      created: new Date('2026-01-02T03:04:05.000Z'),
      displayName: 'User Name',
      email: 'user@example.com',
      emailTemporary: 'temporary@example.com',
      public: true,
      username: 'username',
    };
    await submit(
      {
        message: 'Hello',
        email: 'ignored@example.com',
        reportMember: 'reported-user',
        username: 'ignored',
      },
      user,
      { headers: { 'user-agent': 'UserAgent' } },
    );
    const [replyTo, data] = email.firstCall.args;
    assert.deepEqual(replyTo, {
      address: 'user@example.com',
      name: 'User Name',
    });
    assert.partialDeepStrictEqual(data, {
      authenticated: 'yes',
      displayName: 'User Name',
      email: 'user@example.com',
      emailTemp: 'temporary@example.com',
      profilePublic: 'yes',
      reportMember: 'reported-user',
      signupDate: user.created.toString(),
      userId: user._id.toString(),
      username: 'username',
    });
    assert.partialDeepStrictEqual(stored(), {
      category: 'reportMember',
      reportMember: 'reported-user',
      user: user._id,
    });
    assert.deepEqual(stat.firstCall.args[0].tags, {
      authenticated: 'yes',
      category: 'reportMember',
      type: 'reportMember',
    });
  });

  it('continues and sends email when DB save fails', async () => {
    saveWith(() => Promise.reject(new Error('db down')));
    const res = await submit(HELP, undefined, AGENT);
    answered(res, 200, 'Support request sent.');
    assert.equal(email.callCount, 1);
    assert.ok(
      log.calledWith(
        'error',
        'Failed storing support request to the DB. #39ghsa',
      ),
    );
  });

  it('continues without logging when the save rejects without a value', async () => {
    saveWith(() => Promise.reject());
    const res = await submit(GUEST);
    answered(res, 200, 'Support request sent.');
    assert.equal(
      log.calledWith(
        'error',
        'Failed storing support request to the DB. #39ghsa',
      ),
      false,
    );
  });

  for (const category of [
    'account',
    'reportMember',
    'reportBug',
    'volunteering',
    'other',
  ] as const) {
    it(`stores and emails the ${category} category`, async () => {
      await submit({
        category,
        message: 'Support enquiry.',
        email: 'visitor@example.test',
        reportMember: 'example-member',
      });
      const data = email.firstCall.args[1];
      assert.equal(data.categoryLabel, SUPPORT_CATEGORIES[category]);
      const reportMember =
        category === 'reportMember' ? 'example-member' : undefined;
      assert.equal(saved[0].category, category);
      assert.equal(data.category, category);
      assert.equal(data.reportMember, reportMember ?? false);
      assert.equal(saved[0].reportMember, reportMember);
      assert.partialDeepStrictEqual(stat.firstCall.args[0].tags, {
        category,
        type: reportMember ? 'reportMember' : 'normal',
      });
    });
  }

  for (const category of [
    'unknown',
    'toString',
    '__proto__',
    '',
    null,
    ['other'],
    {},
  ]) {
    it(`rejects invalid category ${JSON.stringify(
      category,
    )} before storage or delivery`, async () => {
      const res = await submit({ category, message: 'Support enquiry.' });
      assert.equal(res.statusCode, 400);
      assert.equal(saved.length, 0);
      assert.equal(email.called, false);
      assert.equal(stat.called, false);
    });
  }

  it('explains why an unknown category was rejected', async () => {
    const res = await submit({ category: 'nonsense' });
    answered(res, 400, 'Please select a valid support category.');
  });

  it('keeps the whitespace of free text fields', async () => {
    await submit({
      message: 'one  two\n\nthree',
      email: 'guest@example.org',
      username: 'a  b',
    });
    const data = email.firstCall.args[1];
    assert.equal(data.message, 'one  two\n\nthree');
    assert.equal(data.username, 'a  b');
    assert.equal(saved[0].message, 'one  two\n\nthree');
  });

  it('passes no build metadata when the app has none', async () => {
    await submit(GUEST);
    assert.equal(email.firstCall.args[1].build, false);
    await submit(GUEST, undefined, {
      app: { locals: { appSettings: {} } },
    });
    assert.equal(email.secondCall.args[1].build, false);
  });

  it('records the request in the stats with a count of one', async () => {
    await submit(GUEST);
    assert.deepEqual(stat.firstCall.args[0], {
      namespace: 'supportRequest',
      counts: { count: 1 },
      tags: { authenticated: 'no', category: 'other', type: 'normal' },
    });
    assert.ok(
      log.calledWith(
        'info',
        'Support request processed and recorded to stats. #2hfsgh',
      ),
    );
  });

  describe('reporting a member', () => {
    function findMember(select: () => Promise<unknown>) {
      return sinon.stub(User, 'findOne').returns({ select } as never);
    }
    const report = (reportMember: unknown, reporter = member()) =>
      submit(
        { category: 'reportMember', reportMember, message: 'Hi' },
        reporter,
      );
    const OTHER = 'Select another existing member to report.';

    it('requires the signed-in reporter to name a member', async () => {
      const find = findMember(async () => null);
      for (const reportMember of [5, true, ['someone'], '', '   \n']) {
        const res = await report(reportMember);
        answered(res, 400, 'Select a member to report.');
      }
      assert.equal(find.callCount, 0);
      assert.equal(saved.length, 0);
    });

    it('looks the member up by trimmed lowercase username', async () => {
      const target = {
        _id: new mongoose.Types.ObjectId(),
        equals: () => false,
      };
      const find = findMember(async () => target);
      assert.equal((await report(' SomeOne ')).statusCode, 200);
      assert.deepEqual(find.firstCall.args[0], { username: 'someone' });
    });

    it('reports a failed member lookup as a server error', async () => {
      findMember(sinon.stub().rejects(new Error('lookup failed')));
      const res = await report('someone');
      answered(res, 500, 'Unable to verify the reported member.');
      assert.equal(saved.length, 0);
    });

    it('rejects unknown members and the reporter themselves', async () => {
      const reporter = member();
      findMember(async () => null);
      const unknown = await report('ghost', reporter);
      answered(unknown, 400, OTHER);
      sinon.restore();
      findMember(async () => ({ _id: reporter._id }));
      const self = await report('reporter', reporter);
      answered(self, 400, OTHER);
    });
  });

  describe('with the support inbox enabled', () => {
    beforeEach(() => {
      config.supportInbox.enabled = true;
    });

    it('answers 503 when the request cannot be stored', async () => {
      sinon.restore();
      sinon
        .stub(SupportRequest.prototype, 'save')
        .rejects(new Error('database down'));
      const logged = sinon.stub(winston.Logger.prototype, 'log');
      const sent = sinon.stub(emailService, 'sendSupportRequest');
      const res = await submit(GUEST);
      answered(
        res,
        503,
        'Unable to save your support request. Please try again.',
      );
      assert.ok(
        logged.calledWith(
          'error',
          'Failed storing support request to the DB. #39ghsa',
        ),
      );
      assert.equal(sent.called, false);
    });

    describe('storing for real', () => {
      afterEach(utils.clearDatabase);

      beforeEach(() => {
        (SupportRequest.prototype.save as sinon.SinonStub).restore();
        sinon.stub(agenda, 'create').callsFake((() => ({
          save: async () => {},
        })) as never);
      });

      it('queues an acknowledgement and confirms the request', async () => {
        const res = await submit(GUEST);
        answered(res, 200, 'Support request sent.');
        const stored = await SupportRequest.findOne().lean<{
          _id: unknown;
          email?: string;
        }>();
        assert.equal(stored?.email, 'guest@example.org');
        const ack = await mongoose
          .model('SupportMessage')
          .findOne({ request: stored?._id, kind: 'acknowledgement' })
          .lean();
        assert.ok(ack);
        assert.equal(email.called, false);
        assert.equal(stat.callCount, 1);
      });

      it('confirms a request without a usable email address without acknowledging it', async () => {
        const res = await submit({ message: 'Hi', email: 'not an email' });
        answered(res, 200, 'Support request sent.');
        assert.equal(
          await mongoose.model('SupportMessage').countDocuments(),
          0,
        );
        assert.equal(email.called, false);
      });
    });

    it('answers 503 when the acknowledgement cannot be queued', async () => {
      // The stubbed save stores nothing, so queueing the acknowledgement fails.
      const res = await submit(GUEST);
      answered(
        res,
        503,
        'Your request was saved but its acknowledgement could not be queued. Please contact support if necessary.',
      );
      assert.ok(
        log.calledWith('error', 'Unable to queue support acknowledgement.'),
      );
      assert.equal(email.called, false);
      assert.equal(stat.called, false);
    });
  });

  it('logs a coded error when the support email cannot be sent', async () => {
    email.callsFake((_replyTo, _data, callback) =>
      callback(new Error('SMTP down')),
    );
    const res = await submit(GUEST);
    answered(
      res,
      400,
      'Failure while sending your support request. Please try again.',
    );
    assert.equal(stat.called, false);
    assert.ok(
      log.calledWith(
        'error',
        'Failed sending support request via email. #49ghsd',
        {
          code: 'SUPPORT_EMAIL_FAILED',
        },
      ),
    );
  });
});
