const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
require('should');
const express = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const controller = require('../../server/controllers/admin.support.server.controller.mjs');
const supportController = require('../../../support/server/controllers/support.server.controller.mjs');
const {
  linkHistoricalReport,
} = require('../../../support/server/services/report-link.server.service.mjs');
const User = mongoose.model('User');
const SupportRequest = mongoose.model('SupportRequest');
const Message = mongoose.model('Message');
const Experience = mongoose.model('Experience');
const AuditLog = mongoose.model('AuditLog');

describe('Support team access and investigation', () => {
  let app;
  let users;
  let raw;
  let agent;
  let report;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    raw = utils.generateUsers(5);
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
  const endpoint = id => `/api/admin/support/${id}`;
  async function status(value) {
    return agent
      .patch(endpoint(report._id))
      .set('X-Trustroots-Request', '1')
      .send({ status: value });
  }
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
    (
      await agent.get('/api/admin/support').expect(200)
    ).body.items.length.should.equal(1);
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
    (reopened.resolvedAt === null).should.equal(true);
  });
  it('returns only safe member fields and permits notes and current greeter tools', async () => {
    const member = (
      await agent.get(`/api/admin/support-members/${users[1]._id}`).expect(200)
    ).body;
    member.roles.should.containEql('suspended');
    member.pendingDeletion.should.equal(true);
    [
      'password',
      'salt',
      'emailToken',
      'resetPasswordToken',
      'removeProfileToken',
      'lastIpAddress',
    ].forEach(field => Object.hasOwn(member, field).should.equal(false));
    (
      await agent
        .get(`/api/admin/support-members?search=${users[1].username}`)
        .expect(200)
    ).body.length.should.equal(1);
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
    for (const url of [
      '/api/admin/audit-log',
      '/api/admin/dashboard',
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
        .send({ id: users[1]._id, role: 'suspended' })
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
      await agent
        .get(`/api/admin/support-members/${id}`)
        .expect(id === 'bad' ? 400 : 404);
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
  it('covers controller defaults and request-list pagination', async () => {
    await SupportRequest.insertMany(
      Array.from({ length: 51 }, () => ({ message: 'Fictional request' })),
    );
    const res = { send: sinon.spy(), status: sinon.stub().returnsThis() };
    await controller.list(
      {
        user: users[0],
        query: {},
        params: {},
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
    (
      (await SupportRequest.findById(report._id)).reportedUser === undefined
    ).should.equal(true);
    await linkHistoricalReport(mapping, users[3]._id, true);
    (await SupportRequest.findById(report._id)).reportedUser
      .toString()
      .should.equal(mapping.reportedUserId);
    for (const data of [
      {},
      { ...mapping, evidence: '' },
      { ...mapping, reportedUserId: users[4]._id.toString() },
    ]) {
      await linkHistoricalReport(data, users[3]._id, true).should.be.rejected();
    }
    await linkHistoricalReport(mapping, users[0]._id).should.be.rejected();
    await linkHistoricalReport(
      { ...mapping, requestId: new mongoose.Types.ObjectId().toString() },
      users[3]._id,
    ).should.be.rejected();
  });
  it('allows administrators to grant and remove the support role', async () => {
    const admin = request.agent(app);
    await utils.signIn(raw[3], admin);
    for (const action of ['add', 'remove']) {
      await admin
        .post('/api/admin/user/change-role')
        .set('X-Trustroots-Request', '1')
        .send({ id: users[4]._id, role: 'support-team', action })
        .expect(200);
      (await User.findById(users[4]._id)).roles
        .includes('support-team')
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
    });
    const response = { status: sinon.stub().returnsThis(), send: sinon.spy() };
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
