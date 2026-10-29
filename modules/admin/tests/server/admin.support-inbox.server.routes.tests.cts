import type { HydratedDocument, Types } from 'mongoose';
import type { SupportRequestRecord } from '../../../support/server/models/support.server.model.mts';
import type { SupportMessageRecord } from '../../../support/server/models/support-message.server.model.mts';
import type {
  TestAgent,
  TestExpressApp,
} from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const sinon: typeof import('sinon') = require('sinon');
require('should');
const express: typeof import('../../../../config/lib/express.mjs') & {
  init(connection: import('mongoose').Connection): Promise<TestExpressApp>;
} = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const agenda: typeof import('../../../../config/lib/agenda.mts').default = require('../../../../config/lib/agenda.mts');
const {
  migrateSupportInbox,
}: typeof import('../../../support/server/services/support-migration.server.service.mts') = require('../../../support/server/services/support-migration.server.service.mts');
const Request = mongoose.model<SupportRequestRecord>('SupportRequest');
const SupportMessage = mongoose.model<SupportMessageRecord>('SupportMessage');
const Audit = mongoose.model('AuditLog');

describe('Shared support inbox', () => {
  let app: TestExpressApp;
  let agent: TestAgent;
  let report: HydratedDocument<SupportRequestRecord>;
  let users: Awaited<ReturnType<typeof utils.saveUsers>>;
  let raw: ReturnType<typeof utils.generateUsersWithSharedPassword>;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    raw = utils.generateUsersWithSharedPassword(3);
    raw[0].roles = ['user', 'support-team'];
    raw[1].roles = ['user', 'admin'];
    users = await utils.saveUsers(raw);
    agent = request.agent(app);
    await utils.signIn(raw[0], agent);
    report = await Request.create({
      category: 'account',
      email: 'fictional-requester@example.test',
      username: 'fictional-requester',
      message: 'Original fictional request [literal].',
      subject: 'Fictional account query',
      sent: new Date('2026-01-01'),
      status: 'new',
    });
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  const endpoint = (id: Types.ObjectId | string) => `/api/admin/support/${id}`;
  const write = (path: string, body: object) =>
    agent.post(path).set('X-Trustroots-Request', '1').send(body);

  it('combines literal search, category and six status filters with independent counts', async () => {
    for (const status of [
      'open',
      'pending',
      'hold',
      'solved',
      'closed',
      'resolved',
    ] as const) {
      await Request.create({
        category: 'account',
        message: 'Fictional other request',
        status,
      });
    }
    await Request.collection.insertOne({
      category: 'other',
      message: 'Fictional legacy request',
      sent: new Date(),
    });
    await Request.collection.insertOne({
      category: 'other',
      message: 'Fictional null status request',
      status: null,
      sent: new Date(),
    });
    const initial = await agent.get('/api/admin/support').expect(200);
    initial.body.total.should.equal(9);
    initial.body.matchingTotal.should.equal(6);
    initial.body.statusCounts.should.deepEqual({
      new: 1,
      open: 1,
      pending: 1,
      hold: 1,
      solved: 2,
      closed: 1,
    });
    initial.body.unconfirmedCount.should.equal(2);
    const unconfirmed = await agent
      .get('/api/admin/support?status=unconfirmed')
      .expect(200);
    unconfirmed.body.matchingTotal.should.equal(2);
    unconfirmed.body.items
      .every(
        (item: { statusProvenance: string }) =>
          item.statusProvenance === 'missing',
      )
      .should.equal(true);
    Object.hasOwn(initial.body.items[0], 'message').should.equal(false);
    const filtered = await agent
      .get('/api/admin/support?status=closed&category=account')
      .expect(200);
    filtered.body.total.should.equal(9);
    filtered.body.matchingTotal.should.equal(1);
    filtered.body.statusCounts.open.should.equal(1);
    for (const status of [
      'new',
      'open',
      'pending',
      'hold',
      'solved',
      'closed',
      'all',
      'resolved',
      'unconfirmed',
    ]) {
      await agent
        .get(`/api/admin/support?status=${status}&category=account`)
        .expect(200);
    }
    const literal = await agent
      .get('/api/admin/support')
      .query({ q: '[literal]', status: 'all' })
      .expect(200);
    literal.body.items
      .map((item: { _id: string }) => item._id)
      .should.deepEqual([String(report._id)]);
    const absent = await agent
      .get('/api/admin/support?q=unmatched-fictional-query')
      .expect(200);
    absent.body.matchingTotal.should.equal(0);
    absent.body.statusCounts.new.should.equal(0);
    await agent
      .get('/api/admin/support')
      .query({ q: ['invalid', 'second'] })
      .expect(400);
    await agent
      .get('/api/admin/support')
      .query({ q: 'x'.repeat(201) })
      .expect(400);
    (
      await agent.get('/api/admin/support?q=%20%20').expect(200)
    ).body.total.should.equal(9);
  });

  it('searches replies and identifiers without copying search text into the audit log', async () => {
    await Request.updateOne(
      { _id: report._id },
      { $set: { zendeskTicketId: 12345 } },
    );
    await SupportMessage.create({
      request: report._id,
      direction: 'inbound',
      body: 'Fictional unique follow-up phrase',
      messageId: '<fictional-search@example.test>',
      deliveryState: 'received',
    });
    for (const q of [
      'unique FOLLOW-up',
      String(report._id),
      '12345',
      'fictional-requester@example.test',
      'Fictional account query',
    ]) {
      const result = await agent
        .get('/api/admin/support')
        .query({ q })
        .expect(200);
      result.body.matchingTotal.should.equal(1);
    }
    const logs = await Audit.find({ 'query.hasSearch': true }).lean();
    logs.length.should.equal(5);
    JSON.stringify(logs).includes('unique FOLLOW-up').should.equal(false);
    JSON.stringify(logs)
      .includes('fictional-requester@example.test')
      .should.equal(false);
  });

  it('shares a paginated conversation across support accounts without leaking mail internals', async () => {
    await SupportMessage.insertMany(
      Array.from({ length: 51 }, (_, i) => ({
        request: report._id,
        direction: 'outbound',
        kind: 'reply',
        body: `Fictional response ${i}`,
        createdAt: new Date(Date.UTC(2026, 1, 1, 0, i)),
        authorId: users[0]._id,
        authorName: 'Fictional Support',
        messageId: `<fictional-page-${i}@example.test>`,
        emailTo: 'fictional-requester@example.test',
        idempotencyKey: `fictional-page-${i}`,
        deliveryState: 'accepted',
      })),
    );
    const first = await agent
      .get(`${endpoint(report._id)}/conversation`)
      .expect(200);
    first.body.items.length.should.equal(50);
    first.body.items[0].kind.should.equal('initial');
    first.body.items[0].body.should.equal(report.message);
    first.body.hasMore.should.equal(true);
    Object.hasOwn(first.body.items[1], 'messageId').should.equal(false);
    const second = await agent
      .get(`${endpoint(report._id)}/conversation?page=2`)
      .expect(200);
    second.body.items.length.should.equal(2);
    second.body.hasMore.should.equal(false);
    const another = request.agent(app);
    await utils.signIn(raw[1], another);
    (
      await another.get(`${endpoint(report._id)}/conversation`).expect(200)
    ).body.items[1].authorName.should.equal('Fictional Support');
    await request(app)
      .get(`${endpoint(report._id)}/conversation`)
      .expect(403);
    await Request.collection.updateOne(
      { _id: report._id },
      { $unset: { username: '', initialAttachments: '' } },
    );
    const legacy = await agent
      .get(`${endpoint(report._id)}/conversation`)
      .expect(200);
    legacy.body.items[0].authorName.should.equal(
      'fictional-requester@example.test',
    );
    legacy.body.items[0].attachments.should.deepEqual([]);
  });

  it('updates all statuses, preserves legacy links and detects concurrent status updates', async () => {
    for (const status of [
      'new',
      'open',
      'pending',
      'hold',
      'solved',
      'closed',
      'resolved',
    ]) {
      const result = await agent
        .patch(endpoint(report._id))
        .set('X-Trustroots-Request', '1')
        .send({ status })
        .expect(200);
      result.body.status.should.equal(
        status === 'resolved' ? 'solved' : status,
      );
    }
    await Request.collection.updateOne(
      { _id: report._id },
      { $unset: { statusRevision: '' } },
    );
    await agent
      .patch(endpoint(report._id))
      .set('X-Trustroots-Request', '1')
      .send({ status: 'open' })
      .expect(200);
    sinon
      .stub(Request, 'updateOne')
      .resolves({ matchedCount: 0 } as unknown as Awaited<
        ReturnType<typeof Request.updateOne>
      >);
    await agent
      .patch(endpoint(report._id))
      .set('X-Trustroots-Request', '1')
      .send({ status: 'closed' })
      .expect(409);
  });

  it('queues and retries replies through explicit staff-only endpoints', async () => {
    sinon
      .stub(config, 'supportInbox')
      .value({ ...config.supportInbox, enabled: true });
    sinon
      .stub(agenda, 'create')
      .returns({ save: async () => ({}) } as unknown as ReturnType<
        typeof agenda.create
      >);
    const posted = await write(`${endpoint(report._id)}/replies`, {
      body: 'Fictional staff response',
      idempotencyKey: 'fictional-api-key',
    }).expect(201);
    posted.body.deliveryState.should.equal('queued');
    Object.hasOwn(posted.body, 'emailTo').should.equal(false);
    await write(`${endpoint(report._id)}/replies`, {
      body: 'Fictional staff response',
      idempotencyKey: 'fictional-api-key',
    }).expect(201);
    (await SupportMessage.countDocuments({ request: report._id })).should.equal(
      1,
    );
    await SupportMessage.updateOne(
      { _id: posted.body._id },
      { $set: { deliveryState: 'failed' } },
    );
    const retried = await write(
      `${endpoint(report._id)}/replies/${posted.body._id}/retry`,
      { idempotencyKey: 'fictional-retry-key' },
    ).expect(200);
    retried.body.deliveryState.should.equal('queued');
    await write(`${endpoint(report._id)}/replies/bad/retry`, {
      idempotencyKey: 'fictional-retry',
    }).expect(400);
    await write(`${endpoint(report._id)}/replies`, {
      body: '',
      idempotencyKey: 'fictional-empty',
    }).expect(400);
    await request(app)
      .post(`${endpoint(report._id)}/replies`)
      .set('X-Trustroots-Request', '1')
      .send({ body: 'Denied' })
      .expect(403);
  });

  it('migrates legacy statuses without changing historical activity or sending messages', async () => {
    await Request.collection.updateOne(
      { _id: report._id },
      {
        $set: { status: 'resolved' },
        $unset: { statusRevision: '', lastActivityAt: '' },
      },
    );
    await Request.collection.insertOne({
      message: 'Fictional legacy',
      sent: new Date('2026-01-02'),
    });
    const before = await migrateSupportInbox();
    before.should.deepEqual({
      resolved: 1,
      missing: 1,
      missingActivity: 2,
      missingCategory: 1,
      applied: false,
    });
    (await Request.findById(report._id))!.status.should.equal('resolved');
    await migrateSupportInbox(true);
    const after = await migrateSupportInbox(true);
    after.resolved.should.equal(0);
    after.missing.should.equal(0);
    after.missingActivity.should.equal(0);
    after.missingCategory.should.equal(0);
    (await SupportMessage.countDocuments()).should.equal(0);
  });

  it('normalises historical categories without creating private investigation links', async () => {
    const inserted = await Request.collection.insertMany([
      {
        message: 'Fictional old member report',
        reportMember: 'fictional-former-name',
        sent: new Date(),
      },
      {
        message: 'Fictional old other request',
        reportMember: '  ',
        sent: new Date(),
      },
      {
        message: 'Fictional older guest request',
        category: null,
        sent: new Date(),
      },
      {
        message: 'Fictional malformed category',
        category: 'unknown',
        sent: new Date(),
      },
    ]);
    const legacyReport = String(inserted.insertedIds[0]);
    const listed = await agent
      .get('/api/admin/support?category=reportMember')
      .expect(200);
    listed.body.matchingTotal.should.equal(1);
    listed.body.items[0]._id.should.equal(legacyReport);
    const detail = await agent.get(endpoint(legacyReport)).expect(200);
    detail.body.category.should.equal('reportMember');
    await agent.get(`${endpoint(legacyReport)}/messages`).expect(403);
    (
      await agent.get(endpoint(String(inserted.insertedIds[3]))).expect(200)
    ).body.category.should.equal('other');
    await migrateSupportInbox(true);
    (await Request.findById(inserted.insertedIds[0]))!.category.should.equal(
      'reportMember',
    );
    (await Request.findById(inserted.insertedIds[1]))!.category.should.equal(
      'other',
    );
    (await Request.findById(inserted.insertedIds[2]))!.category.should.equal(
      'other',
    );
  });

  it('persists enabled web submissions and queues a threaded acknowledgement without mailbox forwarding', async () => {
    sinon
      .stub(config, 'supportInbox')
      .value({ ...config.supportInbox, enabled: true });
    sinon
      .stub(agenda, 'create')
      .returns({ save: async () => ({}) } as unknown as ReturnType<
        typeof agenda.create
      >);
    await write('/api/support', {
      category: 'account',
      message: 'Fictional new support question',
    }).expect(200);
    const created = await Request.findOne({
      message: 'Fictional new support question',
    }).lean();
    if (!created) throw new Error('Expected the saved request');
    created.status.should.equal('new');
    const ack = await SupportMessage.findOne({ request: created._id }).lean();
    if (!ack) throw new Error('Expected the queued acknowledgement');
    ack.kind.should.equal('acknowledgement');
    ack.emailTo!.should.equal(users[0].email);
  });

  it('fails enabled submissions closed on storage errors and reports acknowledgement queue failure', async () => {
    sinon
      .stub(config, 'supportInbox')
      .value({ ...config.supportInbox, enabled: true });
    const save = sinon
      .stub(Request.prototype, 'save')
      .rejects(new Error('Fictional database failure'));
    await write('/api/support', { message: 'Fictional storage error' }).expect(
      503,
    );
    (await SupportMessage.countDocuments()).should.equal(0);
    save.restore();
    sinon.stub(agenda, 'create').returns({
      save: async () => {
        throw new Error('Fictional queue unavailable');
      },
    } as unknown as ReturnType<typeof agenda.create>);
    await write('/api/support', {
      message: 'Fictional acknowledgement error',
    }).expect(503);
    (
      await Request.countDocuments({
        message: 'Fictional acknowledgement error',
      })
    ).should.equal(1);
  });

  it('retains requests without a usable return address without sending an acknowledgement', async () => {
    sinon
      .stub(config, 'supportInbox')
      .value({ ...config.supportInbox, enabled: true });
    await request(app)
      .post('/api/support')
      .set('X-Trustroots-Request', '1')
      .send({
        category: 'other',
        email: 'not-an-email',
        message: 'Fictional visitor question',
      })
      .expect(200);
    (
      await Request.countDocuments({ message: 'Fictional visitor question' })
    ).should.equal(1);
    (await SupportMessage.countDocuments()).should.equal(0);
  });
});
