const mongoose = require('mongoose');
const sinon = require('sinon');

const adminReferenceThreads = require('../../server/controllers/admin.reference-threads.server.controller');
require('should');

const ReferenceThread = mongoose.model('ReferenceThread');
const User = mongoose.model('User');

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

describe('Admin reference threads controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('sends an empty result when the query resolves null', async () => {
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
    sinon.stub(ReferenceThread, 'aggregate').returns({
      exec: () => Promise.resolve(null),
    });

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    response.body.should.deepEqual({
      items: [],
      topNegativeRecipients: [],
    });
  });

  it('returns top negative recipients', async () => {
    const userId = new mongoose.Types.ObjectId();
    const user = { _id: userId, displayName: 'Negative Receiver' };
    sinon.stub(ReferenceThread, 'find').returns({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              exec: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    });
    sinon.stub(ReferenceThread, 'aggregate').returns({
      exec: () => Promise.resolve([{ _id: userId, count: 3 }]),
    });
    sinon.stub(User, 'find').returns({
      select: () => ({
        exec: () => Promise.resolve([user]),
      }),
    });

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    response.body.topNegativeRecipients.should.deepEqual([
      {
        count: 3,
        user,
      },
    ]);
  });

  it('keeps recipient ids when their profiles are unavailable', async () => {
    const missingUserId = new mongoose.Types.ObjectId();
    sinon.stub(ReferenceThread, 'find').returns({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              exec: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    });
    sinon.stub(ReferenceThread, 'aggregate').returns({
      exec: () =>
        Promise.resolve([
          { _id: null, count: 1 },
          { _id: missingUserId, count: 2 },
        ]),
    });
    sinon.stub(User, 'find').returns({
      select: () => ({
        exec: () => Promise.resolve([]),
      }),
    });

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    response.body.topNegativeRecipients.should.deepEqual([
      { count: 1, user: null },
      { count: 2, user: missingUserId },
    ]);
  });

  it('returns an error response when loading reference threads fails', async () => {
    sinon.stub(ReferenceThread, 'find').returns({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              exec: () => Promise.reject(new Error('lookup failed')),
            }),
          }),
        }),
      }),
    });
    sinon.stub(ReferenceThread, 'aggregate').returns({
      exec: () => Promise.resolve([]),
    });

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.startWith('Snap! Something went wrong.');
  });
});
