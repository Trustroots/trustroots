const mongoose = require('mongoose');
const sinon = require('sinon');

const adminMessages = require('../../server/controllers/admin.messages.server.controller');
require('should');

const Message = mongoose.model('Message');
const ReferenceThread = mongoose.model('ReferenceThread');
const User = mongoose.model('User');

function messageQuery(exec) {
  return {
    sort: () => ({
      populate: () => ({
        populate: () => ({ exec }),
      }),
    }),
  };
}

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
    sinon
      .stub(Message, 'find')
      .returns(messageQuery(cb => cb(new Error('lookup failed'))));

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

  it('returns 400 when reference thread lookup fails', async () => {
    sinon.stub(Message, 'find').returns(messageQuery(cb => cb(null, [])));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(messageQuery(cb => cb(new Error('reference lookup failed'))));

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

  it('uses an empty reference thread list when the lookup returns null', async () => {
    sinon.stub(Message, 'find').returns(messageQuery(cb => cb(null, [])));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(messageQuery(cb => cb(null, null)));

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
    response.body.referenceThreads.should.deepEqual([]);
  });

  it('looks up recipients when no current administrator id is available', async () => {
    const scammerId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();
    sinon.stub(User, 'findOne').returns({
      exec: () => Promise.resolve({ _id: scammerId, username: 'scammer' }),
    });
    sinon.stub(Message, 'distinct').returns({
      exec: () => Promise.resolve([recipientId]),
    });
    const findUsers = sinon.stub(User, 'find').returns({
      select: () => ({
        sort: () => ({
          exec: () =>
            Promise.resolve([{ _id: recipientId, username: 'recipient' }]),
        }),
      }),
    });

    const res = mockResponse();
    await adminMessages.getScammerRecipients(
      { body: { username: 'scammer' } },
      res,
    );
    const response = await res.waitForResponse();

    response.body.recipients.length.should.equal(1);
    findUsers.firstCall.args[0]._id.$in.should.deepEqual([recipientId]);
  });

  it('returns a generic lookup error when recipient discovery fails', async () => {
    sinon.stub(User, 'findOne').returns({
      exec: () => Promise.reject(new Error('lookup failed')),
    });

    const res = mockResponse();
    await adminMessages.getScammerRecipients(
      { body: { username: 'scammer' }, user: { _id: 'admin-id' } },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
  });

  it('rejects missing warning content', async () => {
    const res = mockResponse();
    await adminMessages.sendScammerWarning(
      { body: { username: 'scammer' } },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.equal('Please write a message.');
  });

  it('returns the validation error when warning recipient lookup is invalid', async () => {
    const res = mockResponse();
    await adminMessages.sendScammerWarning(
      { body: { content: 'Safety warning' } },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.equal('Missing `username` field.');
  });

  it('returns a generic warning error when recipient discovery fails', async () => {
    sinon.stub(User, 'findOne').returns({
      exec: () => Promise.reject(new Error('lookup failed')),
    });

    const res = mockResponse();
    await adminMessages.sendScammerWarning(
      {
        body: { content: 'Safety warning', username: 'scammer' },
        user: { _id: 'admin-id' },
      },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
  });
});
