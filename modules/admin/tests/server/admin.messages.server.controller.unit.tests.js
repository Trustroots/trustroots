const mongoose = require('mongoose');
const sinon = require('sinon');

const adminMessages = require('../../server/controllers/admin.messages.server.controller');
require('should');

const Message = mongoose.model('Message');

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

describe('Admin messages controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('rejects invalid user ids', async () => {
    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: 'bad-id',
          user2: new mongoose.Types.ObjectId().toString(),
        },
      },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
    response.body.message.should.equal('Cannot interpret id.');
  });

  it('returns 400 when message lookup fails', async () => {
    sinon.stub(Message, 'find').returns({
      sort: () => ({
        populate: () => ({
          populate: () => ({
            exec: cb => cb(new Error('lookup failed')),
          }),
        }),
      }),
    });

    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: new mongoose.Types.ObjectId().toString(),
          user2: new mongoose.Types.ObjectId().toString(),
        },
      },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
  });
});
