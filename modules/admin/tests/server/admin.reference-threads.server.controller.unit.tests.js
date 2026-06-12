const mongoose = require('mongoose');
const sinon = require('sinon');

const adminReferenceThreads = require('../../server/controllers/admin.reference-threads.server.controller');
require('should');

const ReferenceThread = mongoose.model('ReferenceThread');

function mockResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Admin reference threads controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('sends an empty array when the query resolves null', async () => {
    sinon.stub(ReferenceThread, 'find').returns({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              exec: () => Promise.resolve(null),
            }),
          }),
        }),
      }),
    });

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    response.body.should.deepEqual([]);
  });
});
