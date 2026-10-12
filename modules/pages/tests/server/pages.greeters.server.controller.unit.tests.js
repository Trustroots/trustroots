const mongoose = require('mongoose');
require('./../../../users/server/models/user.server.model.mjs');
const sinon = require('sinon');
require('should');

function mockResponse() {
  let resolveResponse;
  const response = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => response;
  return res;
}

async function loadController(execHandler) {
  const exec = sinon.stub().callsFake(execHandler);
  const limit = sinon.stub().withArgs(500).returns({ exec });
  const sort = sinon.stub().withArgs('displayName username').returns({ limit });
  const select = sinon
    .stub()
    .withArgs('username displayName')
    .returns({ sort });
  const User = mongoose.model('User');
  sinon.stub(User, 'find').returns({ select });
  const controller = await import(
    '../../server/controllers/pages.greeters.server.controller.mjs'
  );
  return { controller, exec, find: User.find, limit, select, sort };
}

describe('Greeters controller unit tests', () => {
  afterEach(() => sinon.restore());

  it('selects current public greeters and returns only roster fields', async () => {
    const users = [
      {
        _id: 'greeter-id',
        username: 'river',
        displayName: 'River Host',
        email: 'private@example.test',
      },
    ];
    const harness = await loadController(callback => callback(null, users));
    const res = mockResponse();

    harness.controller.list({}, res);
    const response = await res.waitForResponse();

    harness.find
      .calledOnceWithExactly({
        public: true,
        roles: { $all: ['welcome-team'], $nin: ['suspended', 'shadowban'] },
      })
      .should.be.true();
    harness.select
      .calledOnceWithExactly('username displayName')
      .should.be.true();
    harness.sort.calledOnceWithExactly('displayName username').should.be.true();
    harness.limit.calledOnceWithExactly(500).should.be.true();
    response.body.should.deepEqual({
      greeters: [
        {
          _id: 'greeter-id',
          username: 'river',
          displayName: 'River Host',
        },
      ],
    });
  });

  it('returns a server error when the database lookup fails', async () => {
    const harness = await loadController(callback =>
      callback(new Error('lookup failed')),
    );
    const res = mockResponse();

    harness.controller.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(500);
    response.body.message.should.startWith('Snap! Something went wrong.');
  });
});
