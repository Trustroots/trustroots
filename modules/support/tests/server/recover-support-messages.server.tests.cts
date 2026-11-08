const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const MongoClient: typeof import('mongodb').MongoClient =
  require('mongodb').MongoClient;
const sinon: typeof import('sinon') = require('sinon');
const recoveryJob: typeof import('../../server/jobs/recover-support-messages.server.job.mts') = require('../../server/jobs/recover-support-messages.server.job.mts');
const agenda: typeof import('../../../../config/lib/agenda.mjs').default = require('../../../../config/lib/agenda.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

const SupportRequest = mongoose.model('SupportRequest');
interface SupportMessageFields {
  deliveryState?: string;
  errorCode?: string;
  activityAppliedAt?: Date;
  [field: string]: unknown;
}
type ObjectId = import('mongoose').Types.ObjectId;
const SupportMessage = mongoose.model<SupportMessageFields>('SupportMessage');

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000);
let sequence = 0;

function recover() {
  return new Promise<void>((resolve, reject) => {
    recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
      error ? reject(error) : resolve(),
    );
  });
}

function stubJobs() {
  const jobs: Array<{ data: Record<string, unknown> }> = [];
  sinon.stub(agenda, 'create').callsFake(((
    _name: string,
    data: Record<string, unknown>,
  ) => ({
    unique() {
      return this;
    },
    save: async () => {
      jobs.push({ data });
    },
  })) as never);
  return jobs;
}

describe('Support message recovery job', () => {
  let requestId: ObjectId;

  async function message(patch: Record<string, unknown>) {
    return SupportMessage.create({
      request: requestId,
      direction: 'outbound',
      kind: 'reply',
      body: 'Fictional correspondence',
      messageId: `<fictional-recovery-${++sequence}@example.org>`,
      attempts: 0,
      requestRevision: 0,
      ...patch,
    });
  }

  beforeEach(async () => {
    config.supportInbox.enabled = true;
    const request = await SupportRequest.create({
      category: 'other',
      email: 'fictional@example.org',
      message: 'Fictional request',
      status: 'open',
      statusRevision: 0,
    });
    requestId = request._id;
  });

  afterEach(async () => {
    sinon.restore();
    config.supportInbox.enabled = false;
    await utils.clearDatabase();
  });

  it('leaves everything untouched while the support inbox is disabled', async () => {
    config.supportInbox.enabled = false;
    const jobs = stubJobs();
    const sending = await message({
      deliveryState: 'sending',
      lastAttemptAt: minutesAgo(30),
    });
    const queued = await message({
      deliveryState: 'queued',
      createdAt: minutesAgo(30),
    });
    await recover();
    assert.equal(
      (await SupportMessage.findById(sending._id).lean())?.deliveryState,
      'sending',
    );
    assert.equal(
      (await SupportMessage.findById(queued._id).lean())?.deliveryState,
      'queued',
    );
    assert.equal(jobs.length, 0);
  });

  it('only marks sends uncertain after ten minutes', async () => {
    stubJobs();
    const recent = await message({
      deliveryState: 'sending',
      lastAttemptAt: minutesAgo(9),
    });
    const stale = await message({
      deliveryState: 'sending',
      lastAttemptAt: minutesAgo(11),
    });
    await recover();
    assert.equal(
      (await SupportMessage.findById(recent._id).lean())?.deliveryState,
      'sending',
    );
    assert.equal(
      (await SupportMessage.findById(stale._id).lean())?.deliveryState,
      'uncertain',
    );
  });

  it('only re-enqueues messages that have been queued for over a minute', async () => {
    const jobs = stubJobs();
    await message({ deliveryState: 'queued', createdAt: minutesAgo(0.5) });
    const old = await message({
      deliveryState: 'queued',
      createdAt: minutesAgo(2),
    });
    await recover();
    assert.deepEqual(
      jobs.map(job => job.data),
      [{ messageId: String(old._id) }],
    );
  });

  it('only requeues failed acknowledgements that are over a minute old', async () => {
    stubJobs();
    const failed = {
      kind: 'acknowledgement',
      deliveryState: 'failed',
      errorCode: 'queue_failed',
    };
    const recent = await message({ ...failed, createdAt: minutesAgo(0.5) });
    const old = await message({ ...failed, createdAt: minutesAgo(2) });
    await recover();
    const recentSaved = await SupportMessage.findById(recent._id).lean();
    assert.equal(recentSaved?.deliveryState, 'failed');
    assert.equal(recentSaved?.errorCode, 'queue_failed');
    const oldSaved = await SupportMessage.findById(old._id).lean();
    assert.equal(oldSaved?.deliveryState, 'queued');
    assert.equal(oldSaved?.errorCode, undefined);
  });

  it('applies accepted activity even when many other messages exist', async () => {
    stubJobs();
    await SupportMessage.insertMany(
      Array.from({ length: 100 }, () => ({
        request: requestId,
        direction: 'outbound',
        kind: 'reply',
        body: 'Fictional correspondence',
        messageId: `<fictional-recovery-${++sequence}@example.org>`,
        deliveryState: 'accepted',
        acceptedAt: minutesAgo(5),
        activityAppliedAt: minutesAgo(4),
        requestRevision: 0,
      })),
    );
    const pending = await message({
      deliveryState: 'accepted',
      acceptedAt: minutesAgo(3),
      requestActivityAt: undefined,
    });
    await recover();
    assert.ok(
      (await SupportMessage.findById(pending._id).lean())?.activityAppliedAt,
    );
  });

  it('does not rewrite an unfinished Agenda job that already exists', async () => {
    const queued = await message({
      deliveryState: 'queued',
      createdAt: minutesAgo(2),
    });
    const messageId = String(queued._id);
    const later = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await agenda
        .create('send support message', { messageId })
        .schedule(later)
        .save();
      await recover();
      const mongoClient = await MongoClient.connect(config.db.uri);
      try {
        const jobs = await mongoClient
          .db()
          .collection('agendaJobs')
          .find({ name: 'send support message', 'data.messageId': messageId })
          .toArray();
        assert.equal(jobs.length, 1);
        assert.equal(new Date(jobs[0].nextRunAt).getTime(), later.getTime());
      } finally {
        await mongoClient.close();
      }
    } finally {
      await agenda.cancel({
        name: 'send support message',
        data: { messageId },
      });
    }
  });
});
