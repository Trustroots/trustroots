const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const emailService: {
  sendSupportRequest: (
    replyTo: { address: string; name?: string },
    data: Record<string, unknown>,
    callback: (error?: Error | null) => void,
  ) => void;
} = require('../../../core/server/services/email.server.service.mjs');
const statsService: {
  stat: (point: Record<string, unknown>, callback: () => void) => void;
} = require('../../../stats/server/services/stats.server.service.mts');
require('../../server/models/support.server.model.mts');
const agenda: typeof import('../../../../config/lib/agenda.mjs').default = require('../../../../config/lib/agenda.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const controller: typeof import('../../server/controllers/support.server.controller.mts') = require('../../server/controllers/support.server.controller.mts');

const User = mongoose.model('User');
const SupportRequest = mongoose.model('SupportRequest');
const originalInbox = { ...config.supportInbox };

type Body = Record<string, unknown>;
type Reply = { statusCode: number; body: unknown; ended: Promise<void> };

function reply() {
  let end!: () => void;
  const result: Reply & {
    status(code: number): typeof result;
    send(body: unknown): typeof result;
    json(body: unknown): typeof result;
  } = {
    statusCode: 200,
    body: undefined,
    ended: new Promise<void>(resolve => {
      end = resolve;
    }),
    status(code) {
      result.statusCode = code;
      return result;
    },
    send(body) {
      result.body = body;
      end();
      return result;
    },
    json(body) {
      result.body = body;
      end();
      return result;
    },
  };
  return result;
}

const member = () => ({
  _id: new mongoose.Types.ObjectId(),
  username: 'reporter',
  email: 'reporter@example.org',
  displayName: 'Reporter',
  created: new Date('2025-01-01T00:00:00Z'),
});

describe('Support controller behaviour', () => {
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
      .callsFake((_replyTo, _data, callback) => callback(null));
    stat = sinon
      .stub(statsService, 'stat')
      .callsFake((_point, callback) => callback());
    log = sinon.stub(winston.Logger.prototype, 'log');
    config.supportInbox.enabled = false;
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

  it('explains why an unknown category was rejected', async () => {
    const res = await submit({ category: 'nonsense' });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      message: 'Please select a valid support category.',
    });
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
    await submit({ message: 'Hi', email: 'guest@example.org' });
    assert.equal(email.firstCall.args[1].build, false);
    await submit({ message: 'Hi', email: 'guest@example.org' }, undefined, {
      app: { locals: { appSettings: {} } },
    });
    assert.equal(email.secondCall.args[1].build, false);
  });

  it('records the request in the stats with a count of one', async () => {
    await submit({ message: 'Hi', email: 'guest@example.org' });
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
    function findMember(result: unknown) {
      return sinon.stub(User, 'findOne').returns({
        select: sinon.stub().resolves(result),
      } as never);
    }

    it('requires the signed-in reporter to name a member', async () => {
      const find = findMember(null);
      for (const reportMember of [5, true, ['someone'], '', '   \n']) {
        const res = await submit(
          { category: 'reportMember', reportMember, message: 'Hi' },
          member(),
        );
        assert.equal(res.statusCode, 400, JSON.stringify(reportMember));
        assert.deepEqual(res.body, { message: 'Select a member to report.' });
      }
      assert.equal(find.callCount, 0);
      assert.equal(saved.length, 0);
    });

    it('looks the member up by trimmed lowercase username', async () => {
      const target = { _id: new mongoose.Types.ObjectId() };
      const find = findMember({ ...target, equals: () => false });
      const res = await submit(
        { category: 'reportMember', reportMember: ' SomeOne ', message: 'Hi' },
        member(),
      );
      assert.equal(res.statusCode, 200);
      assert.deepEqual(find.firstCall.args[0], { username: 'someone' });
    });

    it('reports a failed member lookup as a server error', async () => {
      sinon.stub(User, 'findOne').returns({
        select: sinon.stub().rejects(new Error('lookup failed')),
      } as never);
      const res = await submit(
        { category: 'reportMember', reportMember: 'someone', message: 'Hi' },
        member(),
      );
      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, {
        message: 'Unable to verify the reported member.',
      });
      assert.equal(saved.length, 0);
    });

    it('rejects unknown members and the reporter themselves', async () => {
      const reporter = member();
      findMember(null);
      const unknown = await submit(
        { category: 'reportMember', reportMember: 'ghost', message: 'Hi' },
        reporter,
      );
      assert.equal(unknown.statusCode, 400);
      assert.deepEqual(unknown.body, {
        message: 'Select another existing member to report.',
      });
      sinon.restore();
      sinon
        .stub(User, 'findOne')
        .returns({ select: async () => ({ _id: reporter._id }) } as never);
      const self = await submit(
        { category: 'reportMember', reportMember: 'reporter', message: 'Hi' },
        reporter,
      );
      assert.equal(self.statusCode, 400);
      assert.deepEqual(self.body, {
        message: 'Select another existing member to report.',
      });
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
      const res = await submit({ message: 'Hi', email: 'guest@example.org' });
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.body, {
        message: 'Unable to save your support request. Please try again.',
      });
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
        const res = await submit({ message: 'Hi', email: 'guest@example.org' });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { message: 'Support request sent.' });
        const stored = await SupportRequest.findOne().lean();
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
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { message: 'Support request sent.' });
        assert.equal(
          await mongoose.model('SupportMessage').countDocuments(),
          0,
        );
        assert.equal(email.called, false);
      });
    });

    it('answers 503 when the acknowledgement cannot be queued', async () => {
      // The stubbed save stores nothing, so queueing the acknowledgement fails.
      const res = await submit({ message: 'Hi', email: 'guest@example.org' });
      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.body, {
        message:
          'Your request was saved but its acknowledgement could not be queued. Please contact support if necessary.',
      });
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
    const res = await submit({ message: 'Hi', email: 'guest@example.org' });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      message: 'Failure while sending your support request. Please try again.',
    });
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
