/**
 * Unit tests for the admin newsletter controller.
 *
 * The HTTP routes for these handlers are currently disabled (see #egW6Qq in
 * `admin.server.routes.js`), so the controller functions are exercised here
 * directly against the test database instead of through supertest.
 */
const mongoose = require('mongoose');

const adminNewsletter = require('../../server/controllers/admin.newsletter.server.controller');
const errorService = require('../../../core/server/services/error.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

/**
 * Minimal Express-like response mock that records what the controller sends
 * back without needing the full HTTP stack.
 */
function mockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
  };

  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.set = function (key, value) {
    res.headers[key] = value;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    return res;
  };

  return res;
}

describe('Admin newsletter controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('list', () => {
    it('returns CSV with only public newsletter subscribers', async () => {
      const _users = utils.generateUsers(3, { public: true, newsletter: true });
      // Public, but not subscribed to the newsletter
      _users[1].newsletter = false;
      // Subscribed, but not a public (confirmed) profile
      _users[2].public = false;

      _users[0].email = 'subscriber@example.com';
      _users[0].firstName = 'Alice';
      _users[0].lastName = 'Anderson';

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.list({}, res);

      res.headers['Content-Type'].should.equal('text/csv');

      const lines = res.body.split('\n');
      lines[0].should.equal('Email Address,First Name,Last Name');
      // Only the single public + subscribed user should be present
      lines.length.should.equal(2);
      lines[1].should.equal('subscriber@example.com,Alice,Anderson');
    });

    it('strips characters that would break CSV files', async () => {
      const _users = utils.generateUsers(1, { public: true, newsletter: true });
      _users[0].email = 'comma@example.com';
      _users[0].firstName = "Bob's";
      _users[0].lastName = 'Smith, "Jr"';

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.list({}, res);

      const lines = res.body.split('\n');
      lines[1].should.equal('comma@example.com,Bobs,Smith Jr');
    });

    it('returns only the header when there are no subscribers', async () => {
      const res = mockResponse();
      await adminNewsletter.list({}, res);

      res.headers['Content-Type'].should.equal('text/csv');
      res.body.should.equal('Email Address,First Name,Last Name');
    });
  });

  describe('listCircleMembers', () => {
    const circleId = '5fbab4f7fed63c7ed73276d3';

    it('responds with 400 when circleId is missing', async () => {
      const res = mockResponse();
      await adminNewsletter.listCircleMembers({ query: {} }, res);

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('responds with 400 when circleId is invalid', async () => {
      const res = mockResponse();
      await adminNewsletter.listCircleMembers(
        { query: { circleId: 'not-an-object-id' } },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('returns only newsletter subscribers of a circle by default', async () => {
      const member = [
        {
          tribe: new mongoose.Types.ObjectId(circleId),
          since: new Date(),
        },
      ];

      const _users = utils.generateUsers(2, { public: true });
      // Circle member, subscribed
      _users[0].newsletter = true;
      _users[0].member = member;
      _users[0].email = 'circle-subscriber@example.com';
      _users[0].firstName = 'Carol';
      _users[0].lastName = 'Clark';
      // Circle member, NOT subscribed
      _users[1].newsletter = false;
      _users[1].member = member;

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.listCircleMembers({ query: { circleId } }, res);

      res.headers['Content-Type'].should.equal('text/csv');

      const lines = res.body.split('\n');
      lines.length.should.equal(2);
      lines[0].should.equal('Email Address,First Name,Last Name');
      lines[1].should.equal('circle-subscriber@example.com,Carol,Clark');
    });

    it('returns all circle members when onlyNewsletterCircleMembers is set', async () => {
      const member = [
        {
          tribe: new mongoose.Types.ObjectId(circleId),
          since: new Date(),
        },
      ];

      const _users = utils.generateUsers(2, { public: true });
      _users[0].newsletter = true;
      _users[0].member = member;
      _users[1].newsletter = false;
      _users[1].member = member;

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.listCircleMembers(
        { query: { circleId, onlyNewsletterCircleMembers: true } },
        res,
      );

      const lines = res.body.split('\n');
      // Header + both circle members regardless of newsletter subscription
      lines.length.should.equal(3);
    });
  });
});
