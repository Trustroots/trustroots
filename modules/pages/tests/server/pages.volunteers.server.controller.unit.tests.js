/**
 * Unit tests for uncovered volunteers controller error paths.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

const volunteersController = require('../../server/controllers/pages.volunteers.server.controller');
const errorService = require('../../../core/server/services/error.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

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

describe('Volunteers controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  it('returns 400 when the database lookup fails', async () => {
    sinon.stub(User, 'find').returns({
      select: () => ({
        sort: () => ({
          limit: () => ({
            exec: cb => cb(new Error('lookup failed')),
          }),
        }),
      }),
    });

    const res = mockResponse();
    volunteersController.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.equal(
      errorService.getErrorMessage(new Error('lookup failed')),
    );
  });

  it('returns volunteers and alumni grouped by role', async () => {
    const volunteer = new User({
      firstName: 'Active',
      lastName: 'Volunteer',
      displayName: 'Active Volunteer',
      email: 'active-volunteer@example.com',
      username: 'unitactivevol',
      password: 'password123',
      provider: 'local',
      roles: ['user', 'volunteer'],
      public: true,
    });
    const alumni = new User({
      firstName: 'Former',
      lastName: 'Volunteer',
      displayName: 'Former Volunteer',
      email: 'former-volunteer@example.com',
      username: 'unitformervol',
      password: 'password123',
      provider: 'local',
      roles: ['user', 'volunteer-alumni'],
      public: true,
    });
    await volunteer.save();
    await alumni.save();

    const res = mockResponse();
    volunteersController.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(200);
    response.body.volunteers.length.should.equal(1);
    response.body.alumni.length.should.equal(1);
    response.body.volunteers[0].username.should.equal('unitactivevol');
    response.body.alumni[0].username.should.equal('unitformervol');
  });
});
