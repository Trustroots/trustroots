const mongoose = require('mongoose');
const emailService = require('./../../../core/server/services/email.server.service.mjs');
const statsService = require('./../../../stats/server/services/stats.server.service.mjs');
const config = require('./../../../../config/config.mjs');
const winston = require('winston');
require('./../../server/models/support.server.model.mjs');
const sinon = require('sinon');

require('should');

function mockResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

async function loadController(options = {}) {
  const savedSupportRequests = [];
  const SupportRequest = mongoose.model('SupportRequest');
  sinon.stub(SupportRequest.prototype, 'save').callsFake(function (callback) {
    savedSupportRequests.push(
      Object.fromEntries(
        Object.entries({
          category: this.category,
          email: this.email,
          message: this.message,
          reportMember: this.reportMember,
          user: this.user,
          userAgent: this.userAgent,
          username: this.username,
        }).filter(([, value]) => value !== undefined),
      ),
    );
    callback(options.saveError || null);
  });
  const sendSupportRequest = sinon
    .stub(emailService, 'sendSupportRequest')
    .callsFake((replyTo, data, callback) =>
      callback(options.emailError || null),
    );
  const stat = sinon
    .stub(statsService, 'stat')
    .callsFake((statsObject, callback) => callback());
  const log = sinon.stub(winston.Logger.prototype, 'log');
  sinon.stub(config, 'supportEmail').value('support@example.test');
  const controller = await import(
    '../../server/controllers/support.server.controller.mjs'
  );

  return {
    controller,
    log,
    savedSupportRequests,
    sendSupportRequest,
    stat,
  };
}

describe('Support controller unit tests', () => {
  afterEach(() => sinon.restore());
  const build = {
    committedAt: '2026-06-21 18:06',
    commitUrl:
      'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
    shortCommit: '7a1d639',
  };

  it('sends a guest support request and records normal guest stats', async () => {
    const harness = await loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    const response = await res.waitForResponse();

    response.body.message.should.equal('Support request sent.');
    harness.sendSupportRequest.calledOnce.should.be.true();
    const [replyTo, supportRequestData] =
      harness.sendSupportRequest.firstCall.args;
    replyTo.should.deepEqual({ address: 'guest@example.com' });
    supportRequestData.should.containEql({
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
    harness.savedSupportRequests[0].should.deepEqual({
      category: 'other',
      email: 'guest@example.com',
      message: 'Need help',
      userAgent: 'TestAgent',
      username: 'guest',
    });
    harness.stat.firstCall.args[0].tags.should.deepEqual({
      authenticated: 'no',
      category: 'other',
      type: 'normal',
    });
  });

  it('adds build metadata to the support email data', async () => {
    const harness = await loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        app: {
          locals: {
            appSettings: {
              build,
            },
          },
        },
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    await res.waitForResponse();

    const supportRequestData = harness.sendSupportRequest.firstCall.args[1];
    supportRequestData.build.should.deepEqual(build);
  });

  it('falls back to support email for invalid guest reply-to addresses', async () => {
    const harness = await loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          email: 'not an email',
          username: 'guest',
        },
        headers: {},
      },
      res,
    );

    await res.waitForResponse();

    const [replyTo, supportRequestData] =
      harness.sendSupportRequest.firstCall.args;
    replyTo.should.deepEqual({ address: 'support@example.test' });
    supportRequestData.message.should.equal('—');
    supportRequestData.userAgent.should.equal('—');
  });

  it('uses signed-in user data for reply-to, storage, and stats', async () => {
    const harness = await loadController();
    const res = mockResponse();
    const created = new Date('2026-01-02T03:04:05.000Z');
    const userId = new mongoose.Types.ObjectId();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Hello',
          email: 'ignored@example.com',
          reportMember: 'reported-user',
          username: 'ignored',
        },
        headers: { 'user-agent': 'UserAgent' },
        user: {
          _id: userId,
          created,
          displayName: 'User Name',
          email: 'user@example.com',
          emailTemporary: 'temporary@example.com',
          public: true,
          username: 'username',
        },
      },
      res,
    );

    await res.waitForResponse();

    const [replyTo, supportRequestData] =
      harness.sendSupportRequest.firstCall.args;
    replyTo.should.deepEqual({
      address: 'user@example.com',
      name: 'User Name',
    });
    supportRequestData.should.containEql({
      authenticated: 'yes',
      displayName: 'User Name',
      email: 'user@example.com',
      emailTemp: 'temporary@example.com',
      profilePublic: 'yes',
      reportMember: 'reported-user',
      signupDate: created.toString(),
      userId: userId.toString(),
      username: 'username',
    });
    harness.savedSupportRequests[0].should.containEql({
      category: 'reportMember',
      reportMember: 'reported-user',
      user: userId,
    });
    harness.stat.firstCall.args[0].tags.should.deepEqual({
      authenticated: 'yes',
      category: 'reportMember',
      type: 'reportMember',
    });
  });

  it('continues and sends email when DB save fails', async () => {
    const harness = await loadController({ saveError: new Error('db down') });
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    const response = await res.waitForResponse();

    response.body.message.should.equal('Support request sent.');
    harness.sendSupportRequest.calledOnce.should.be.true();
    harness.log
      .calledWith('error', 'Failed storing support request to the DB. #39ghsa')
      .should.be.true();
  });

  for (const category of [
    'account',
    'reportMember',
    'reportBug',
    'volunteering',
    'other',
  ]) {
    it(`stores and emails the ${category} category`, async () => {
      const harness = await loadController();
      const res = mockResponse();
      harness.controller.supportRequest(
        {
          body: {
            category,
            message: 'Support enquiry.',
            email: 'visitor@example.test',
            reportMember: 'example-member',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      harness.savedSupportRequests[0].category.should.equal(category);
      const data = harness.sendSupportRequest.firstCall.args[1];
      data.category.should.equal(category);
      harness.stat.firstCall.args[0].tags.should.containEql({
        category,
        type: category === 'reportMember' ? 'reportMember' : 'normal',
      });
      if (category === 'reportMember') {
        data.reportMember.should.equal('example-member');
        harness.savedSupportRequests[0].reportMember.should.equal(
          'example-member',
        );
      } else {
        data.reportMember.should.equal(false);
        require('should').not.exist(
          harness.savedSupportRequests[0].reportMember,
        );
      }
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
      const harness = await loadController();
      const res = mockResponse();
      harness.controller.supportRequest(
        { body: { category, message: 'Support enquiry.' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      harness.savedSupportRequests.length.should.equal(0);
      harness.sendSupportRequest.called.should.equal(false);
      harness.stat.called.should.equal(false);
    });
  }

  it('returns 400 and does not record stats when email send fails', async () => {
    const harness = await loadController({
      emailError: new Error('smtp failed'),
    });
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.containEql('Failure while sending');
    harness.stat.called.should.be.false();
    harness.log
      .calledWith('error', 'Failed sending support request via email. #49ghsd')
      .should.be.true();
  });
});
