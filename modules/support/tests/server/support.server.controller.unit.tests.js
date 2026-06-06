const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const mongoose = require('mongoose');

const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const SupportRequest = mongoose.model('SupportRequest');

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

describe('Support controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  it('continues and sends email when DB save fails', async () => {
    const sendSupportRequest = sinon
      .stub()
      .callsFake((replyTo, data, cb) => cb(null));
    const stat = sinon.stub().callsFake((obj, cb) => cb(null));
    const controller = proxyquire(
      '../../server/controllers/support.server.controller',
      {
        '../../../stats/server/services/stats.server.service': { stat },
        '../../../core/server/services/email.server.service': {
          sendSupportRequest,
        },
      },
    );

    sinon.stub(SupportRequest.prototype, 'save').callsFake(cb => {
      cb(new Error('db down'));
    });

    const res = mockResponse();
    controller.supportRequest(
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
    sendSupportRequest.calledOnce.should.be.true();
  });

  it('returns 400 when email send fails', async () => {
    const controller = proxyquire(
      '../../server/controllers/support.server.controller',
      {
        '../../../stats/server/services/stats.server.service': {
          stat: sinon.stub(),
        },
        '../../../core/server/services/email.server.service': {
          sendSupportRequest: (replyTo, data, cb) =>
            cb(new Error('smtp failed')),
        },
      },
    );

    const res = mockResponse();
    controller.supportRequest(
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
  });
});
