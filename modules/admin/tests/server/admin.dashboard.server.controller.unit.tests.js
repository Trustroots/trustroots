const mongoose = require('mongoose');
const sinon = require('sinon');

const adminDashboard = require('../../server/controllers/admin.dashboard.server.controller');
require('should');

const Message = mongoose.model('Message');
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

describe('Admin dashboard controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns top messengers and recent negative reviews', async () => {
    const messengerId = new mongoose.Types.ObjectId();
    const messenger = {
      _id: messengerId,
      displayName: 'Top Sender',
      username: 'topsender',
    };
    const negativeReview = {
      _id: new mongoose.Types.ObjectId(),
      reference: 'no',
    };

    sinon.stub(Message, 'aggregate').returns({
      exec: () => Promise.resolve([{ _id: messengerId, messageCount: 7 }]),
    });
    sinon.stub(User, 'find').returns({
      select: () => ({
        exec: () => Promise.resolve([messenger]),
      }),
    });
    sinon.stub(ReferenceThread, 'find').returns({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              exec: () => Promise.resolve([negativeReview]),
            }),
          }),
        }),
      }),
    });

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.should.deepEqual({
      negativeReviews: [negativeReview],
      topMessengers: [
        {
          messageCount: 7,
          user: messenger,
        },
      ],
    });
  });

  it('uses empty dashboard lists when dashboard queries return null', async () => {
    sinon.stub(Message, 'aggregate').returns({
      exec: () => Promise.resolve(null),
    });
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
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.should.deepEqual({
      negativeReviews: [],
      topMessengers: [],
    });
  });

  it('keeps fallback messenger identities when their profiles are unavailable', async () => {
    const missingMessengerId = new mongoose.Types.ObjectId();
    sinon.stub(Message, 'aggregate').returns({
      exec: () =>
        Promise.resolve([
          { _id: null, messageCount: 1 },
          { _id: missingMessengerId, messageCount: 2 },
        ]),
    });
    sinon.stub(User, 'find').returns({
      select: () => ({
        exec: () => Promise.resolve([]),
      }),
    });
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

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.topMessengers.should.deepEqual([
      { messageCount: 1, user: null },
      { messageCount: 2, user: { _id: missingMessengerId } },
    ]);
  });

  it('returns an error response when dashboard queries fail', async () => {
    sinon.stub(Message, 'aggregate').returns({
      exec: () => Promise.reject(new Error('db failed')),
    });

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.startWith('Snap! Something went wrong.');
  });
});
