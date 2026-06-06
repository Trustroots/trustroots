const proxyquire = require('proxyquire').noCallThru();
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

function loadController(options = {}) {
  const savedSupportRequests = [];

  function FakeSupportRequest(data) {
    this.data = data;
  }

  FakeSupportRequest.prototype.save = function (callback) {
    savedSupportRequests.push(this.data);
    callback(options.saveError || null);
  };

  const sendSupportRequest = sinon
    .stub()
    .callsFake((replyTo, data, callback) =>
      callback(options.emailError || null),
    );
  const stat = sinon.stub().callsFake((statsObject, callback) => callback());
  const log = sinon.spy();
  const plainText = sinon.stub().callsFake(value => value);

  const controller = proxyquire(
    '../../server/controllers/support.server.controller',
    {
      '../../../../config/config': {
        supportEmail: 'support@example.test',
      },
      '../../../../config/lib/logger': log,
      '../../../core/server/services/email.server.service': {
        sendSupportRequest,
      },
      '../../../core/server/services/text.server.service': {
        plainText,
      },
      '../../../stats/server/services/stats.server.service': { stat },
      mongoose: {
        model: () => FakeSupportRequest,
      },
    },
  );

  return {
    controller,
    log,
    plainText,
    savedSupportRequests,
    sendSupportRequest,
    stat,
  };
}

describe('Support controller unit tests', () => {
  it('sends a guest support request and records normal guest stats', async () => {
    const harness = loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: '<p>Need help</p>',
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
      message: '<p>Need help</p>',
      profilePublic: 'no',
      reportMember: false,
      signupDate: '-',
      userAgent: 'TestAgent',
      userId: '-',
      username: 'guest',
    });
    harness.savedSupportRequests[0].should.deepEqual({
      email: 'guest@example.com',
      message: '<p>Need help</p>',
      userAgent: 'TestAgent',
      username: 'guest',
    });
    harness.stat.firstCall.args[0].tags.should.deepEqual({
      authenticated: 'no',
      type: 'normal',
    });
  });

  it('falls back to support email for invalid guest reply-to addresses', async () => {
    const harness = loadController();
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
    const harness = loadController();
    const res = mockResponse();
    const created = new Date('2026-01-02T03:04:05.000Z');
    const userId = {
      toString: () => 'user-id',
    };

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
      userId: 'user-id',
      username: 'username',
    });
    harness.savedSupportRequests[0].should.containEql({
      reportMember: 'reported-user',
      user: userId,
    });
    harness.stat.firstCall.args[0].tags.should.deepEqual({
      authenticated: 'yes',
      type: 'reportMember',
    });
  });

  it('continues and sends email when DB save fails', async () => {
    const harness = loadController({ saveError: new Error('db down') });
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

  it('returns 400 and does not record stats when email send fails', async () => {
    const harness = loadController({ emailError: new Error('smtp failed') });
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
