/**
 * Unit tests for the admin newsletter controller.
 *
 * These handlers are exercised directly against the test database.
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
    it('returns CSV with only email-eligible newsletter subscribers', async () => {
      const _users = utils.generateUsers(5, { public: true, newsletter: true });
      // Public, but not subscribed to the newsletter
      _users[1].newsletter = false;
      // Subscribed, but not a public (confirmed) profile
      _users[2].public = false;
      // Subscribed, but suspended
      _users[3].roles = ['user', 'suspended'];
      // Subscribed, but pending profile deletion
      _users[4].removeProfileToken = 'remove-token';
      _users[4].removeProfileExpires = Date.now() + 3600 * 1000;

      _users[0].email = 'subscriber@example.com';
      _users[0].firstName = 'Alice';
      _users[0].lastName = 'Anderson';

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.list({}, res);

      res.headers['Content-Type'].should.equal('text/csv');

      const lines = res.body.split('\n');
      lines[0].should.equal('Email Address,First Name,Last Name');
      // Only the single eligible user should be present
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

    it('returns only email-eligible newsletter subscribers of a circle by default', async () => {
      const member = [
        {
          tribe: new mongoose.Types.ObjectId(circleId),
          since: new Date(),
        },
      ];

      const _users = utils.generateUsers(4, { public: true });
      // Circle member, subscribed
      _users[0].newsletter = true;
      _users[0].member = member;
      _users[0].email = 'circle-subscriber@example.com';
      _users[0].firstName = 'Carol';
      _users[0].lastName = 'Clark';
      // Circle member, NOT subscribed
      _users[1].newsletter = false;
      _users[1].member = member;
      // Circle member, subscribed, but suspended
      _users[2].newsletter = true;
      _users[2].member = member;
      _users[2].roles = ['user', 'suspended'];
      // Circle member, subscribed, but pending profile deletion
      _users[3].newsletter = true;
      _users[3].member = member;
      _users[3].removeProfileToken = 'remove-token';
      _users[3].removeProfileExpires = Date.now() + 3600 * 1000;

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

  describe('splitSubscribers', () => {
    it('responds with 422 when no CSV upload is present', async () => {
      const res = mockResponse();

      await adminNewsletter.splitSubscribers({}, res);

      res.statusCode.should.equal(422);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('unprocessable-entity'),
      );
    });

    it('responds with 400 when uploaded CSV contains no valid emails', async () => {
      const res = mockResponse();

      await adminNewsletter.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(
              'Email Address\nnot-an-email\nstill-not-an-email',
            ),
          },
        },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Could not find any email addresses in the uploaded CSV file.',
      );
    });

    it('splits uploaded recipients into subscribed and unsubscribed CSV files', async () => {
      const _users = utils.generateUsers(5, {
        public: true,
        newsletter: false,
      });
      _users[0].email = 'subscribed@example.com';
      _users[0].firstName = 'Subscribed';
      _users[0].lastName = 'Member';
      _users[0].newsletter = true;

      _users[1].email = 'unsubscribed@example.com';
      _users[1].firstName = 'Unsubscribed';
      _users[1].lastName = 'Member';
      _users[1].newsletter = false;

      // Non-public users are treated as unsubscribed in this tool.
      _users[2].email = 'private@example.com';
      _users[2].firstName = 'Private';
      _users[2].lastName = 'Member';
      _users[2].newsletter = true;
      _users[2].public = false;
      // Suspended users are treated as unsubscribed.
      _users[3].email = 'suspended@example.com';
      _users[3].firstName = 'Suspended';
      _users[3].lastName = 'Member';
      _users[3].newsletter = true;
      _users[3].roles = ['user', 'suspended'];
      // Deletion-pending users are treated as unsubscribed.
      _users[4].email = 'pending-delete@example.com';
      _users[4].firstName = 'Pending';
      _users[4].lastName = 'Deletion';
      _users[4].newsletter = true;
      _users[4].removeProfileToken = 'remove-token';
      _users[4].removeProfileExpires = Date.now() + 3600 * 1000;

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(
              [
                'Email Address',
                'subscribed@example.com',
                'unsubscribed@example.com',
                'private@example.com',
                'suspended@example.com',
                'pending-delete@example.com',
                'missing@example.com',
                'SUBSCRIBED@example.com',
              ].join('\n'),
            ),
          },
        },
        res,
      );

      res.statusCode.should.equal(200);
      res.body.totalEmailCount.should.equal(6);
      res.body.subscribedCount.should.equal(1);
      res.body.unsubscribedCount.should.equal(5);
      res.body.subscribedCsv.should.equal(
        'Email Address,First Name,Last Name\nsubscribed@example.com,Subscribed,Member',
      );
      res.body.unsubscribedCsv.should.equal(
        [
          'Email Address,First Name,Last Name,Reason',
          'unsubscribed@example.com,Unsubscribed,Member,Newsletter disabled',
          'private@example.com,Private,Member,Profile not public',
          'suspended@example.com,Suspended,Member,Account suspended',
          'pending-delete@example.com,Pending,Deletion,Profile deletion pending',
          'missing@example.com,,,Email not found',
        ].join('\n'),
      );
    });
  });
});
