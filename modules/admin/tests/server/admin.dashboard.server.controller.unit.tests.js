const mongoose = require('mongoose');
const sinon = require('sinon');

const adminDashboard = require('../../server/controllers/admin.dashboard.server.controller');
require('should');

const Experience = mongoose.model('Experience');
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
  let findNegativeExperiences;

  beforeEach(() => {
    findNegativeExperiences = sinon.stub(Experience, 'find').returns({
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
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns top messengers and recent thread votes', async () => {
    const messengerId = new mongoose.Types.ObjectId();
    const messenger = {
      _id: messengerId,
      displayName: 'Top Sender',
      username: 'topsender',
    };
    const threadVote = {
      _id: new mongoose.Types.ObjectId(),
      reference: 'no',
    };
    const negativeExperience = {
      _id: new mongoose.Types.ObjectId(),
      recommend: 'no',
    };
    const negativeExperienceExec = sinon.stub().resolves([negativeExperience]);
    const negativeExperiencePopulateTo = sinon
      .stub()
      .returns({ exec: negativeExperienceExec });
    const negativeExperiencePopulateFrom = sinon
      .stub()
      .returns({ populate: negativeExperiencePopulateTo });
    const negativeExperienceLimit = sinon
      .stub()
      .returns({ populate: negativeExperiencePopulateFrom });
    const negativeExperienceSort = sinon
      .stub()
      .returns({ limit: negativeExperienceLimit });
    findNegativeExperiences.returns({ sort: negativeExperienceSort });

    sinon.stub(Message, 'aggregate').returns({
      exec: () => Promise.resolve([{ _id: messengerId, messageCount: 7 }]),
    });
    sinon.stub(User, 'find').returns({
      select: () => ({
        exec: () => Promise.resolve([messenger]),
      }),
    });
    const findThreadVotes = sinon.stub(ReferenceThread, 'find').returns({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              exec: () => Promise.resolve([threadVote]),
            }),
          }),
        }),
      }),
    });

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.should.deepEqual({
      negativeExperiences: [negativeExperience],
      threadVotes: [threadVote],
      topMessengers: [
        {
          messageCount: 7,
          user: messenger,
        },
      ],
    });
    sinon.assert.calledOnceWithExactly(findNegativeExperiences, {
      recommend: 'no',
    });
    sinon.assert.calledOnceWithExactly(negativeExperienceSort, '-created');
    sinon.assert.calledOnceWithExactly(negativeExperienceLimit, 10);
    sinon.assert.calledOnceWithExactly(findThreadVotes, {});
  });

  it('uses empty dashboard lists when dashboard queries return null', async () => {
    findNegativeExperiences.returns({
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
      negativeExperiences: [],
      threadVotes: [],
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
