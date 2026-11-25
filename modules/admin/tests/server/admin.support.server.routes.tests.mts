import express from '../../../../config/lib/express.mts';
import mongoose, { type HydratedDocument, Types } from 'mongoose';
import request from 'supertest';
import sinon from 'sinon';
import should from 'should';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import controller from '../../server/controllers/admin.support.server.controller.mts';
import supportController from '../../../support/server/controllers/support.server.controller.mts';
import { linkHistoricalReport } from '../../../support/server/services/report-link.server.service.mts';
import type { MessageThrottleReviewRecord } from '../../../messages/server/models/message-throttle-alert.server.model.mts';
import type {
  ExperienceRecord,
  MessageRecord,
  TestAgent,
  TestExpressApp,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

interface SupportRequestRecord {
  category?: string;
  user?: Types.ObjectId;
  reportedUser?: Types.ObjectId;
  reportMember?: string;
  message?: string;
  username?: string;
  email?: string;
  sent?: Date;
  status?: string;
  resolvedAt?: Date | null;
}
interface AuditLogRecord {
  user?: Types.ObjectId;
  route?: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}
type SupportUserFixture = ReturnType<
  typeof utils.generateUsersWithSharedPassword
>[number] & {
  removeProfileToken?: string;
  emailToken?: string;
};
const User = mongoose.model<UserRecord, UserModel>('User');
const SupportRequest = mongoose.model<SupportRequestRecord>('SupportRequest');
const Message = mongoose.model<MessageRecord>('Message');
const MessageThrottleReview = mongoose.model<MessageThrottleReviewRecord>(
  'MessageThrottleReview',
);
const Experience = mongoose.model<ExperienceRecord>('Experience');
const AuditLog = mongoose.model<AuditLogRecord>('AuditLog');

describe('Support team access and investigation', () => {
  let app: TestExpressApp;
  let users: Awaited<ReturnType<typeof utils.saveUsers>>;
  let raw: SupportUserFixture[];
  let agent: TestAgent;
  let report: HydratedDocument<SupportRequestRecord>;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    raw = utils.generateUsersWithSharedPassword(5);
    raw[0].roles = ['user', 'support-team'];
    raw[1].roles = ['user', 'suspended', 'shadowban'];
    raw[1].removeProfileToken = 'secret-deletion-token';
    raw[1].emailToken = 'secret-email-token';
    raw[1].public = false;
    raw[3].roles = ['user', 'admin'];
    users = await utils.saveUsers(raw);
    agent = request.agent(app);
    await utils.signIn(raw[0], agent);
    report = await SupportRequest.create({
      category: 'reportMember',
      user: users[2]._id,
      reportedUser: users[1]._id,
      reportMember: users[1].username,
      message: 'Fictional safety report.',
      username: users[2].username,
      email: users[2].email,
    });
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  const endpoint = (id: Types.ObjectId | string) => `/api/admin/support/${id}`;
  const reviewEndpoint = (id: Types.ObjectId | string) =>
    `/api/admin/support-message-reviews/${id}`;
  async function status(value: string) {
    return agent
      .patch(endpoint(report._id))
      .set('X-Trustroots-Request', '1')
      .send({ status: value });
  }
  it('allows support to apply restrictions and protects self, administrators and suspensions', async () => {
    const changeRole = (id: Types.ObjectId, role: string, action = 'add') =>
      agent
        .post('/api/admin/user/change-role')
        .set('X-Trustroots-Request', '1')
        .send({ id, role, action });
    const target = users[2]._id;
    const forbidden = {
      message: 'This role change is restricted to administrators.',
    };
    await changeRole(users[0]._id, 'suspended').expect(403, forbidden);
    await changeRole(users[3]._id, 'shadowban').expect(403, forbidden);
    await changeRole(target, 'shadowban').expect(200);
    (await User.findById(target))!.roles!.should.containEql('shadowban');
    await changeRole(target, 'shadowban', 'remove').expect(403, forbidden);
    await changeRole(target, 'suspended').expect(200);
    await changeRole(target, 'suspended').expect(200);
    await changeRole(target, 'shadowban').expect(403, forbidden);
    const saved = (await User.findById(target))!;
    saved.roles!.should.containEql('suspended');
    saved.roles!.should.not.containEql('shadowban');
    should(saved.public).be.false();
    should(saved.newsletter).be.false();
  });

  it('flags and unflags profiles idempotently without changing account state', async () => {
    const target = users[2];
    const before = await User.findById(target._id).lean();
    const path = `/api/admin/support-members/${target._id}/flag`;
    for (const flagged of [true, true, false, false]) {
      await agent
        .patch(path)
        .send({ flagged, roles: ['admin'], public: false })
        .expect(200);
      const saved = await User.findById(target._id).lean();
      saved!.roles!.includes('flagged').should.equal(flagged);
      saved!
        .roles!.filter(role => role !== 'flagged')
        .should.deepEqual(before!.roles);
      (saved!.public === before!.public).should.be.true();
      (saved!.newsletter === before!.newsletter).should.be.true();
      (saved!.authVersion === before!.authVersion).should.be.true();
    }
    const audits = await AuditLog.find({
      route: '/api/admin/support-members/:memberId/flag',
    }).lean();
    audits.length.should.equal(4);
    const values = audits as unknown as { body: { flagged: boolean } }[];
    values
      .map(item => item.body.flagged)
      .should.deepEqual([true, true, false, false]);
    await utils.signOut(agent);
    await utils.signIn(raw[3], agent);
    await agent.patch(path).send({ flagged: true }).expect(200);
    await agent
      .post('/api/admin/users/by-role')
      .send({ role: 'flagged' })
      .expect(200);
  });

  it('omits non-boolean flag values from a Support audit entry', async () => {
    await agent
      .patch(endpoint(report._id))
      .set('X-Trustroots-Request', '1')
      .send({ status: 'open', flagged: 'fictional text' })
      .expect(200);

    const audit = await AuditLog.findOne({
      user: users[0]._id,
      route: '/api/admin/support/:requestId',
    })
      .lean()
      .orFail();
    should(audit.body).deepEqual({ status: 'open' });
  });

  it('lists flagged members on bounded stable pages without private content', async () => {
    const fixtures = Array.from({ length: 51 }, (_, index) => ({
      username: `flagged-fixture-${index}`,
      email: `flagged-fixture-${index}@example.test`,
      displayName: 'Fictional Member',
      roles: ['user', 'flagged'],
      public: true,
    }));
    await User.collection.insertMany(fixtures);
    const first = await agent
      .get('/api/admin/support-flagged-members')
      .expect(200);
    first.body.items.length.should.equal(50);
    first.body.hasMore.should.equal(true);
    first.body.items[0].username.should.equal('flagged-fixture-0');
    Object.keys(first.body.items[0])
      .sort()
      .should.deepEqual(['_id', 'displayName', 'public', 'roles', 'username']);
    const second = await agent
      .get('/api/admin/support-flagged-members?page=2')
      .expect(200);
    second.body.items.length.should.equal(1);
    second.body.items[0].username.should.equal('flagged-fixture-50');
    second.body.hasMore.should.equal(false);
    await User.updateOne(
      { username: 'flagged-fixture-0' },
      { $pull: { roles: 'flagged' } },
    );
    const changed = await agent
      .get('/api/admin/support-flagged-members')
      .expect(200);
    changed.body.items[0].username.should.equal('flagged-fixture-1');
    await agent
      .get('/api/admin/support-flagged-members?page=1000000')
      .expect(400);
  });

  it('rejects invalid flag inputs and missing accounts', async () => {
    const path = `/api/admin/support-members/${users[2]._id}/flag`;
    await agent.patch(path).set('X-Trustroots-Request', '1').expect(400);
    for (const flagged of [undefined, null, 'true', 1, {}, []]) {
      await agent.patch(path).send({ flagged }).expect(400);
    }
    await agent
      .patch('/api/admin/support-members/invalid/flag')
      .send({ flagged: true })
      .expect(400);
    await agent
      .patch('/api/admin/support-members/000000000000000000000001/flag')
      .send({ flagged: false })
      .expect(404);
    sinon
      .stub(AuditLog.prototype, 'save')
      .rejects(new Error('audit unavailable'));
    await agent.patch(path).send({ flagged: true }).expect(500);
    const saved = await User.findById(users[2]._id).lean();
    saved!.roles!.includes('flagged').should.be.false();
  });

  it('denies flag APIs to visitors, regular members, greeters and flagged members', async () => {
    const path = `/api/admin/support-members/${users[2]._id}/flag`;
    await request(app).get('/api/admin/support-flagged-members').expect(403);
    await request(app).patch(path).send({ flagged: true }).expect(403);
    await utils.signOut(agent);
    for (const roles of [
      ['user'],
      ['user', 'welcome-team'],
      ['user', 'flagged'],
    ]) {
      await User.updateOne({ _id: users[2]._id }, { $set: { roles } });
      await utils.signIn(raw[2], agent);
      await agent.get('/api/admin/support-flagged-members').expect(403);
      await agent.patch(path).send({ flagged: true }).expect(403);
      await agent
        .post('/api/admin/user/change-role')
        .send({ id: users[2]._id, role: 'admin' })
        .expect(403);
      const profile = await agent
        .get(`/api/users/${users[2].username}`)
        .expect(200);
      should.not.exist(profile.body.roles);
      const shell = await agent.get('/').expect(200);
      shell.text.should.not.containEql('"flagged"');
      await utils.signOut(agent);
    }
  });

  it('returns and audits only outgoing messages within the saved window', async () => {
    const windowStart = new Date('2026-01-01T12:00:00.000Z');
    const windowEnd = new Date('2026-01-01T13:00:00.000Z');
    const sender = users[1]._id;
    const recipient = users[2]._id;
    const review = await MessageThrottleReview.create({
      sender,
      windowStart,
      windowEnd,
    });
    const outgoing = { userFrom: sender, userTo: recipient };
    await Message.insertMany([
      { ...outgoing, created: new Date(+windowStart - 1), content: 'Earlier' },
      {
        ...outgoing,
        created: windowStart,
        content: 'At start',
        shadowHidden: true,
      },
      ...Array.from({ length: 49 }, (_, index) => ({
        ...outgoing,
        created: new Date(+windowStart + 1),
        content: `Message ${index}`,
      })),
      { ...outgoing, created: windowEnd, content: 'At end' },
      { ...outgoing, created: new Date(+windowEnd + 1), content: 'Later' },
      {
        userFrom: recipient,
        userTo: sender,
        created: windowStart,
        content: 'Incoming',
      },
      {
        userFrom: users[4]._id,
        userTo: recipient,
        created: windowStart,
        content: 'Other sender',
      },
    ]);

    const path = reviewEndpoint(review._id);
    const first = await agent
      .get(path)
      .query({
        sender: users[4]._id.toString(),
        windowStart: '2025-01-01',
        windowEnd: '2027-01-01',
        category: 'Fictional extra query data',
      })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    first.body.windowStart.should.equal(windowStart.toISOString());
    first.body.windowEnd.should.equal(windowEnd.toISOString());
    first.body.hasMore.should.equal(true);
    first.body.items
      .map((item: { content: string }) => item.content)
      .should.eql([
        'At start',
        ...Array.from({ length: 49 }, (_, index) => `Message ${index}`),
      ]);
    first.body.items[0].shadowHidden.should.equal(true);
    Object.hasOwn(first.body.items[0], 'userFrom').should.equal(false);
    first.body.items[0].userTo.username.should.equal(users[2].username);
    Object.hasOwn(first.body.items[0].userTo, 'email').should.equal(false);
    const second = await agent.get(path).query({ page: 2 }).expect(200);
    second.body.hasMore.should.equal(false);
    second.body.items
      .map((item: { content: string }) => item.content)
      .should.eql(['At end']);

    const logs = await AuditLog.find({
      user: users[0]._id,
      route: '/api/admin/support-message-reviews/:reviewId',
      'params.reviewId': review._id.toString(),
    })
      .sort({ _id: 1 })
      .lean();
    logs.map(log => log.query).should.eql([{ page: 1 }, { page: 2 }]);
    logs
      .every(log => Object.keys(log.body ?? {}).length === 0)
      .should.equal(true);

    await Message.deleteOne({ ...outgoing, created: windowEnd });
    const fullPage = await agent.get(path).expect(200);
    fullPage.body.items.should.have.length(50);
    fullPage.body.hasMore.should.equal(false);

    sinon
      .stub(AuditLog.prototype, 'save')
      .rejects(new Error('Audit unavailable'));
    const failed = await agent.get(path).expect(500);
    Object.hasOwn(failed.body, 'items').should.equal(false);
  });

  it('requires a valid review ID and a Support or administrator role', async () => {
    const review = await MessageThrottleReview.create({
      sender: users[1]._id,
      windowStart: new Date('2026-01-01T12:00:00.000Z'),
      windowEnd: new Date('2026-01-01T13:00:00.000Z'),
    });
    const path = reviewEndpoint(review._id);
    await request(app).get(path).expect(403);
    for (const role of ['user', 'moderator', 'welcome-team', 'admin']) {
      await User.updateOne(
        { _id: users[4]._id },
        { $set: { roles: ['user', role] } },
      );
      const session = request.agent(app);
      await utils.signIn(raw[4], session);
      const res = await session.get(path).expect(role === 'admin' ? 200 : 403);
      if (role === 'admin') res.body.items.should.eql([]);
    }
    await agent.get(reviewEndpoint('bad')).expect(400);
    await agent
      .get(reviewEndpoint(new mongoose.Types.ObjectId()))
      .expect(404, { message: 'Message review not found.' });
    await agent.get(path).query({ page: 1_000_000 }).expect(400);
  });
  it('finds exact repeated messages across distinct recipients within a resolved report window', async () => {
    const windowEnd = new Date('2026-02-01T12:00:00.000Z');
    const windowStart = new Date('2026-01-02T12:00:00.000Z');
    await SupportRequest.updateOne(
      { _id: report._id },
      { $set: { sent: windowEnd, status: 'solved' } },
    );
    const userFrom = users[1]._id;
    const recipients = [users[2]._id, users[3]._id, users[4]._id];
    const content = 'Fictional greeting';
    await Message.insertMany([
      ...recipients.map((userTo, index) => ({
        userFrom,
        userTo,
        content,
        created: index === 0 ? windowStart : windowEnd,
        shadowHidden: index === 0,
      })),
      { userFrom, userTo: recipients[0], content, created: windowEnd },
      ...[
        ['Different Case', 'different case', 'different case'],
        ['Punctuation!', 'Punctuation.', 'Punctuation.'],
        ['Inner  space', 'Inner space', 'Inner space'],
      ].flatMap(variants =>
        recipients.map((userTo, index) => ({
          userFrom,
          userTo,
          content: variants[index],
          created: windowEnd,
        })),
      ),
      ...Array.from({ length: 4 }, () => ({
        userFrom,
        userTo: recipients[0],
        content: 'One recipient',
        created: windowEnd,
      })),
      ...recipients.map((userTo, index) => ({
        userFrom,
        userTo,
        content: 'Crosses the window',
        created: [
          new Date(+windowStart - 1),
          windowEnd,
          new Date(+windowEnd + 1),
        ][index],
      })),
      ...recipients.map(userTo => ({
        userFrom: users[0]._id,
        userTo,
        content: 'Another sender',
        created: windowEnd,
      })),
    ]);
    const path = `${endpoint(report._id)}/repeated-messages`;
    await request(app).get(path).expect(403);
    const result = await agent
      .get(path)
      .query({
        sender: users[0]._id.toString(),
        windowEnd: '2030-01-01',
        category: 'Fictional extra query data',
      })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    result.body.should.eql({
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      page: 1,
      hasMore: false,
      items: [
        {
          content,
          recipientCount: 3,
          sendCount: 4,
          firstSent: windowStart.toISOString(),
          lastSent: windowEnd.toISOString(),
        },
      ],
    });
    const log = await AuditLog.findOne({
      user: users[0]._id,
      route: '/api/admin/support/:requestId/repeated-messages',
      'params.requestId': report._id.toString(),
    }).orFail();
    log.query!.should.eql({ page: 1 });
    sinon
      .stub(AuditLog.prototype, 'save')
      .rejects(new Error('Audit unavailable'));
    const failed = await agent.get(path).expect(500);
    Object.hasOwn(failed.body, 'items').should.equal(false);
    await SupportRequest.updateOne(
      { _id: report._id },
      { $unset: { sent: 1 } },
    );
    await agent.get(path).expect(400);
    await SupportRequest.updateOne(
      { _id: report._id },
      { $unset: { reportedUser: 1 } },
    );
    await agent.get(path).expect(403);
  });

  it('requires password confirmation before Support or administrators can read repeated messages', async () => {
    const review = await MessageThrottleReview.create({
      sender: users[1]._id,
      windowStart: new Date('2026-01-01T12:00:00.000Z'),
      windowEnd: new Date('2026-01-01T13:00:00.000Z'),
    });
    const paths = [
      `${endpoint(report._id)}/repeated-messages`,
      `${reviewEndpoint(review._id)}/repeated-messages`,
    ];
    const routes = [
      '/api/admin/support/:requestId/repeated-messages',
      '/api/admin/support-message-reviews/:reviewId/repeated-messages',
    ];

    for (const index of [0, 3]) {
      const { username, password } = raw[index];
      const session = request.agent(app);
      await session
        .post('/api/auth/signin')
        .send({ username, password })
        .expect(200);

      for (const path of paths) {
        const { body } = await session
          .get(path)
          .expect(403)
          .expect('Cache-Control', 'no-store');
        body.code.should.equal('ADMIN_ELEVATION_REQUIRED');
        Object.hasOwn(body, 'items').should.equal(false);
      }
      const audits = AuditLog.countDocuments({
        user: users[index]._id,
        route: { $in: routes },
      });
      (await audits.exec()).should.equal(0);

      await utils.elevateAdminAccess(session, password);
      for (const path of paths) {
        const { body } = await session.get(path).expect(200);
        body.items.should.eql([]);
      }
      (await audits.clone().exec()).should.equal(2);
    }

    const member = request.agent(app);
    await utils.signIn(raw[2], member);
    for (const path of paths) {
      const { body } = await member.get(path).expect(403);
      Object.hasOwn(body, 'code').should.equal(false);
      Object.hasOwn(body, 'items').should.equal(false);
    }
  });

  it('paginates repeat groups after counting all messages in the alert window', async () => {
    const sender = users[1]._id;
    const windowStart = new Date('2026-01-01T12:00:00.000Z');
    const windowEnd = new Date('2026-01-01T13:00:00.000Z');
    const review = await MessageThrottleReview.create({
      sender,
      windowStart,
      windowEnd,
    });
    const recipients = [users[2]._id, users[3]._id, users[4]._id];
    await Message.insertMany([
      ...Array.from({ length: 51 }, (_, index) => {
        const content = `Fictional repeat ${String(index).padStart(2, '0')}`;
        return recipients.map(userTo => ({
          userFrom: sender,
          userTo,
          content,
          created: windowStart,
        }));
      }).flat(),
      ...recipients.map(userTo => ({
        userFrom: sender,
        userTo,
        content: 'Outside the alert',
        created: new Date(+windowEnd + 1),
      })),
    ]);
    const path = `${reviewEndpoint(review._id)}/repeated-messages`;
    await request(app).get(path).expect(403);
    const first = await agent.get(path).expect(200);
    first.body.items.length.should.equal(50);
    first.body.hasMore.should.equal(true);
    const second = await agent.get(path).query({ page: 2 }).expect(200);
    second.body.items.should.eql([
      {
        content: 'Fictional repeat 50',
        recipientCount: 3,
        sendCount: 3,
        firstSent: windowStart.toISOString(),
        lastSent: windowStart.toISOString(),
      },
    ]);
    second.body.hasMore.should.equal(false);
  });
  it('triages requests, records access and keeps resolved investigations available', async () => {
    await Message.create([
      {
        userFrom: users[1]._id,
        userTo: users[2]._id,
        content: 'Hidden context',
        shadowHidden: true,
      },
      {
        userFrom: users[2]._id,
        userTo: users[1]._id,
        content: 'Reply context',
      },
      {
        userFrom: users[1]._id,
        userTo: users[4]._id,
        content: 'Unrelated private message',
      },
    ]);
    await Experience.create({
      userFrom: users[1]._id,
      userTo: users[2]._id,
      feedbackPublic: 'Unpublished feedback',
      public: false,
    });
    const listed = await agent.get('/api/admin/support').expect(200);
    listed.body.items.length.should.equal(1);
    Object.hasOwn(listed.body.items[0], 'message').should.equal(false);
    (
      await agent.get(endpoint(report._id)).expect(200)
    ).body.message.should.equal(report.message);
    (await status('resolved')).status.should.equal(200);
    (
      await agent.get('/api/admin/support').expect(200)
    ).body.items.length.should.equal(0);
    (
      await agent
        .get('/api/admin/support?status=resolved&category=reportMember')
        .expect(200)
    ).body.items.length.should.equal(1);
    const messages = (
      await agent
        .get(`${endpoint(report._id)}/messages?user1=${users[4]._id}`)
        .expect(200)
    ).body;
    messages.items.length.should.equal(2);
    messages.items[0].shadowHidden.should.equal(true);
    const experiences = (
      await agent.get(`${endpoint(report._id)}/experiences`).expect(200)
    ).body;
    experiences.items[0].feedbackPublic.should.equal('Unpublished feedback');
    experiences.items[0].public.should.equal(false);
    (await Message.countDocuments({ read: false })).should.equal(3);
    (await AuditLog.countDocuments({ user: users[0]._id })).should.be.above(5);
    (await status('open')).status.should.equal(200);
    const reopened = await SupportRequest.findById(report._id);
    if (!reopened) throw new Error('Expected the support request');
    (reopened.resolvedAt === null).should.equal(true);
  });
  it('returns only safe member fields and permits notes and current greeter tools', async () => {
    const member = (
      await agent
        .get(`/api/admin/support-members/${users[1].username}`)
        .expect(200)
    ).body;
    member.roles.should.containEql('suspended');
    member.pendingDeletion.should.equal(true);
    (
      await agent.get(`/api/admin/support-members/${users[1]._id}`).expect(200)
    ).body.username.should.equal(users[1].username);
    [
      'password',
      'salt',
      'emailToken',
      'resetPasswordToken',
      'removeProfileToken',
      'lastIpHash',
    ].forEach(field => Object.hasOwn(member, field).should.equal(false));
    (
      await agent
        .get(`/api/admin/support-members?search=${users[1].username}`)
        .expect(200)
    ).body.length.should.equal(1);
    (
      await agent
        .get(
          `/api/admin/support-members?search=${encodeURIComponent(users[1].email)}`,
        )
        .expect(200)
    ).body
      .map((member: { username: string }) => member.username)
      .should.containEql(users[1].username);
    const namedMembers = (
      await agent
        .get(
          `/api/admin/support-members?search=${encodeURIComponent(users[1].displayName!)}`,
        )
        .expect(200)
    ).body;
    namedMembers
      .map((member: { username: string }) => member.username)
      .should.containEql(users[1].username);
    namedMembers.forEach((member: object) =>
      Object.hasOwn(member, 'score').should.equal(false),
    );
    type FindUsers = (
      filter?: import('mongoose').QueryFilter<
        import('../../../../testutils/server/model-contracts.mts').UserRecord
      >,
    ) => ReturnType<typeof User.find>;
    const originalFind = User.find as unknown as FindUsers;
    (sinon.stub(User, 'find') as unknown as sinon.SinonStub).callsFake(
      function (this: typeof User, ...args: Parameters<FindUsers>) {
        const criteria = args[0];
        if (
          typeof criteria === 'object' &&
          criteria !== null &&
          '$text' in criteria
        ) {
          return {
            select() {
              return this;
            },
            sort() {
              return this;
            },
            limit() {
              return this;
            },
            lean: () => Promise.reject(new Error('text index unavailable')),
          } as unknown as ReturnType<typeof User.find>;
        }
        return originalFind.apply(this, args);
      },
    );
    (
      await agent
        .get(
          `/api/admin/support-members?search=${encodeURIComponent(users[1].displayName!)}`,
        )
        .expect(200)
    ).body
      .map((member: { username: string }) => member.username)
      .should.containEql(users[1].username);
    sinon.restore();
    const page = Array.from({ length: 50 }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(),
      username: `fictional-page-${index}`,
    }));
    let lookups = 0;
    sinon.stub(User, 'find').callsFake(function (
      this: typeof User,
      ...args: Parameters<FindUsers>
    ) {
      lookups += 1;
      const criteria = args[0];
      if (
        typeof criteria === 'object' &&
        criteria !== null &&
        '$text' in criteria
      ) {
        throw new Error('text search should not run for a full indexed page');
      }
      return {
        select() {
          return this;
        },
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        lean: async () => page,
      } as unknown as ReturnType<typeof User.find>;
    });
    (
      await agent
        .get('/api/admin/support-members?search=fictional-page')
        .expect(200)
    ).body.length.should.equal(50);
    lookups.should.equal(1);
    sinon.restore();
    await agent
      .post('/api/admin/notes')
      .set('X-Trustroots-Request', '1')
      .send({ userId: users[1]._id, note: 'Fictional support note.' })
      .expect(200);
    (
      await agent.get(`/api/admin/notes?userId=${users[1]._id}`).expect(200)
    ).body.length.should.equal(1);
    await agent.get('/api/admin/staff-blockers').expect(200);
    await agent
      .post('/api/admin/acquisition-stories')
      .set('X-Trustroots-Request', '1')
      .expect(200);
    await agent.get('/api/admin/dashboard').expect(200);
    for (const url of [
      '/api/admin/audit-log',
      '/api/admin/reference-threads',
      '/api/admin/newsletter-subscribers',
    ])
      await agent.get(url).expect(403);
    for (const url of [
      '/api/admin/messages',
      '/api/admin/user',
      '/api/admin/user/change-role',
    ])
      await agent
        .post(url)
        .set('X-Trustroots-Request', '1')
        .send({ id: users[1]._id, role: 'support-team' })
        .expect(403);
  });
  it('denies ordinary members, moderators and greeters, and permits administrators', async () => {
    for (const role of ['user', 'moderator', 'welcome-team', 'admin']) {
      await User.updateOne(
        { _id: users[4]._id },
        { $set: { roles: ['user', role] } },
      );
      const session = request.agent(app);
      await utils.signIn(raw[4], session);
      await session
        .get('/api/admin/support')
        .expect(role === 'admin' ? 200 : 403);
    }
    await request(app).get('/api/admin/support').expect(403);
    await User.updateOne(
      { _id: users[0]._id },
      { $set: { roles: ['user'] }, $inc: { authVersion: 1 } },
    );
    await agent.get('/api/admin/support').expect(403);
  });
  it('handles legacy, guest and invalid reports without unlocking conversations', async () => {
    await SupportRequest.collection.updateOne(
      { _id: report._id },
      { $unset: { status: '', reportedUser: '' } },
    );
    (
      await agent.get('/api/admin/support').expect(200)
    ).body.items.length.should.equal(1);
    await agent.get(`${endpoint(report._id)}/messages`).expect(403);
    await SupportRequest.updateOne(
      { _id: report._id },
      { $set: { reportedUser: users[1]._id }, $unset: { user: '' } },
    );
    await agent.get(`${endpoint(report._id)}/messages`).expect(403);
    await SupportRequest.updateOne(
      { _id: report._id },
      { $set: { user: users[1]._id } },
    );
    await agent.get(`${endpoint(report._id)}/messages`).expect(403);
    await SupportRequest.updateOne(
      { _id: report._id },
      { $set: { category: 'account' } },
    );
    await agent.get(`${endpoint(report._id)}/messages`).expect(403);
  });
  it('validates filters, identifiers and paging', async () => {
    for (const query of [
      'page=1000000',
      'status=invalid',
      'category=invalid',
      'category[]=account',
    ])
      await agent.get(`/api/admin/support?${query}`).expect(400);
    for (const id of ['bad', new mongoose.Types.ObjectId().toString()]) {
      await agent.get(endpoint(id)).expect(id === 'bad' ? 400 : 404);
      await agent.get(`/api/admin/support-members/${id}`).expect(404);
    }
    for (const search of ['', 'ab', 'x'.repeat(255)])
      await agent
        .get(`/api/admin/support-members?search=${search}`)
        .expect(400);
    (await status('invalid')).status.should.equal(400);
    await agent.get(`${endpoint(report._id)}/unknown`).expect(400);
    (
      await agent.get('/api/admin/support?status=all&page=2').expect(200)
    ).body.items.length.should.equal(0);
  });
  it('paginates complete history and fails closed when audit storage fails', async () => {
    await Message.insertMany(
      Array.from({ length: 51 }, (_, i) => ({
        userFrom: users[1]._id,
        userTo: users[2]._id,
        content: `Context ${i}`,
      })),
    );
    (
      await agent.get(`${endpoint(report._id)}/messages`).expect(200)
    ).body.hasMore.should.equal(true);
    (
      await agent.get(`${endpoint(report._id)}/messages?page=2`).expect(200)
    ).body.items.length.should.equal(1);
    sinon
      .stub(AuditLog.prototype, 'save')
      .rejects(new Error('Storage failure'));
    const response = await agent
      .get(`${endpoint(report._id)}/messages`)
      .expect(500);
    Object.hasOwn(response.body, 'items').should.equal(false);
  });
  it('preserves non-string error messages from legacy audit failures', async () => {
    sinon
      .stub(AuditLog.prototype, 'save')
      .rejects({ status: 422, message: 42 });
    const response = await agent
      .get(`${endpoint(report._id)}/messages`)
      .expect(422);
    response.body.message.should.equal(42);
  });
  it('covers controller defaults and request-list pagination', async () => {
    await SupportRequest.insertMany(
      Array.from({ length: 51 }, () => ({ message: 'Fictional request' })),
    );
    const res = {
      send: sinon.spy(),
      json: sinon.spy(),
      set: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
    };
    await controller.list(
      {
        user: users[0],
        query: {},
        params: {},
        body: {},
        route: { path: '/api/admin/support' },
      },
      res,
    );
    res.send.firstCall.args[0].hasMore.should.equal(true);
    (
      await agent.get('/api/admin/support?status=all&page=2').expect(200)
    ).body.items.length.should.equal(2);
  });
  it('only links historical reports with administrator-verified evidence', async () => {
    await SupportRequest.updateOne(
      { _id: report._id },
      { $unset: { reportedUser: '' } },
    );
    const mapping = {
      requestId: report._id.toString(),
      reportedUserId: users[1]._id.toString(),
      evidence: 'Verified immutable ID in archived support correspondence.',
    };
    await linkHistoricalReport(mapping, users[3]._id);
    const unlinked = await SupportRequest.findById(report._id);
    if (!unlinked) throw new Error('Expected the support request');
    (unlinked.reportedUser === undefined).should.equal(true);
    await linkHistoricalReport(mapping, users[3]._id, true);
    (await SupportRequest.findById(report._id))!
      .reportedUser!.toString()
      .should.equal(mapping.reportedUserId);
    for (const data of [
      {},
      { ...mapping, evidence: '' },
      { ...mapping, reportedUserId: users[4]._id.toString() },
    ]) {
      await linkHistoricalReport(
        data as never,
        users[3]._id,
        true,
      ).should.be.rejected();
    }
    await linkHistoricalReport(mapping, users[0]._id).should.be.rejected();
    await linkHistoricalReport(
      { ...mapping, requestId: new mongoose.Types.ObjectId().toString() },
      users[3]._id,
    ).should.be.rejected();
  });
  it('allows administrators on the support team to grant and remove the support role', async () => {
    await User.updateOne(
      { _id: users[3]._id },
      { $addToSet: { roles: 'support-team' } },
    );
    const admin = request.agent(app);
    await utils.signIn(raw[3], admin);
    for (const action of ['add', 'remove']) {
      await admin
        .post('/api/admin/user/change-role')
        .set('X-Trustroots-Request', '1')
        .send({ id: users[4]._id, role: 'support-team', action })
        .expect(200);
      (await User.findById(users[4]._id))!
        .roles!.includes('support-team')
        .should.equal(action === 'add');
    }
  });
  it('validates authenticated reports and handles target lookup errors', async () => {
    for (const target of [
      '',
      null,
      'missing-fictional-member',
      raw[0].username,
    ]) {
      await agent
        .post('/api/support')
        .set('X-Trustroots-Request', '1')
        .send({
          category: 'reportMember',
          reportMember: target,
          message: 'Fictional report',
        })
        .expect(400);
    }
    sinon.stub(User, 'findOne').returns({
      select: async () => {
        throw new Error('Lookup unavailable');
      },
    } as unknown as ReturnType<typeof User.findOne>);
    const response = {
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
      json: sinon.spy(),
    };
    await supportController.supportRequest(
      {
        body: {
          category: 'reportMember',
          reportMember: raw[1].username,
          message: 'Fictional report',
        },
        user: users[0],
        headers: {},
      },
      response,
    );
    sinon.assert.calledWith(response.status, 500);
    sinon.assert.calledWith(response.send, {
      message: 'Unable to verify the reported member.',
    });
  });
});
