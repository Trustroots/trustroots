/**
 * Unit tests for the volunteers controller.
 */
const mongoose = require('mongoose');
const lodash = require('lodash');
require('../../../users/server/models/user.server.model');
const sinon = require('sinon');

require('should');

function mockResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
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
  res.waitForResponse = () => promise;
  return res;
}

async function loadController(execHandler) {
  const exec = sinon.stub().callsFake(execHandler);
  const limit = sinon.stub().withArgs(500).returns({ exec });
  const sort = sinon.stub().withArgs('firstName username').returns({ limit });
  const select = sinon.stub().withArgs('username firstName roles').returns({
    sort,
  });

  const User = mongoose.model('User');
  sinon.stub(User, 'find').returns({ select });
  sinon.stub(lodash, 'shuffle').callsFake(users => users);
  const controller = await import(
    '../../server/controllers/pages.volunteers.server.controller.mjs'
  );

  return { controller, exec, find: User.find, limit, select, sort };
}

describe('Volunteers controller unit tests', () => {
  afterEach(() => sinon.restore());
  it('queries volunteer and alumni roles with bounded selected results', async () => {
    const harness = await loadController(callback => callback(null, []));
    const res = mockResponse();

    harness.controller.list({}, res);
    await res.waitForResponse();

    harness.find
      .calledOnceWithExactly({
        roles: { $in: ['volunteer', 'volunteer-alumni'] },
      })
      .should.be.true();
    harness.select
      .calledOnceWithExactly('username firstName roles')
      .should.be.true();
    harness.sort.calledOnceWithExactly('firstName username').should.be.true();
    harness.limit.calledOnceWithExactly(500).should.be.true();
  });

  it('returns 400 when the database lookup fails', async () => {
    const harness = await loadController(callback =>
      callback(new Error('lookup failed')),
    );
    const res = mockResponse();

    harness.controller.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.startWith('Snap! Something went wrong.');
  });

  it('returns volunteers and alumni grouped by role with only public fields', async () => {
    const users = [
      {
        _id: 'volunteer-id',
        firstName: 'Active',
        lastName: 'Hidden',
        roles: ['user', 'volunteer'],
        username: 'activevol',
      },
      {
        _id: 'alumni-id',
        firstName: 'Former',
        email: 'hidden@example.com',
        roles: ['user', 'volunteer-alumni'],
        username: 'formervol',
      },
      {
        _id: 'both-id',
        firstName: 'Both',
        roles: ['volunteer', 'volunteer-alumni'],
        username: 'bothvol',
      },
    ];
    const harness = await loadController(callback => callback(null, users));
    const res = mockResponse();

    harness.controller.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(200);
    response.body.volunteers.should.deepEqual([
      {
        _id: 'volunteer-id',
        firstName: 'Active',
        username: 'activevol',
      },
      {
        _id: 'both-id',
        firstName: 'Both',
        username: 'bothvol',
      },
    ]);
    response.body.alumni.should.deepEqual([
      {
        _id: 'alumni-id',
        firstName: 'Former',
        username: 'formervol',
      },
      {
        _id: 'both-id',
        firstName: 'Both',
        username: 'bothvol',
      },
    ]);
  });
});
