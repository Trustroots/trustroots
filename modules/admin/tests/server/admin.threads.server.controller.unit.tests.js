const mongoose = require('mongoose');
const sinon = require('sinon');

const adminThreads = require('../../server/controllers/admin.threads.server.controller');
require('should');

const Thread = mongoose.model('Thread');

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
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Admin threads controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns 400 when thread aggregation fails', async () => {
    sinon.stub(Thread, 'aggregate').returns({
      exec: cb => cb(new Error('aggregate failed')),
    });

    const res = mockResponse();
    adminThreads.getThreads(
      { body: { userId: new mongoose.Types.ObjectId().toString() } },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
  });
});
