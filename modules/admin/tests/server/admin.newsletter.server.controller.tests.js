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

const Offer = mongoose.model('Offer');

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

  describe('audience', () => {
    const berlin = {
      latitude: 52.52,
      longitude: 13.405,
      radiusKm: 50,
    };

    it('matches living and origin text and escapes regular expressions', async () => {
      const _users = utils.generateUsers(4, {
        public: true,
        newsletter: true,
      });
      _users[0].email = 'living@example.com';
      _users[0].locationLiving = 'Berlin (Germany)';
      _users[1].email = 'origin@example.com';
      _users[1].locationFrom = 'Berlin (Germany)';
      _users[2].email = 'other@example.com';
      _users[2].locationLiving = 'Berlin Germany';
      _users[3].email = 'restricted@example.com';
      _users[3].locationLiving = 'Berlin (Germany)';
      _users[3].roles = ['user', 'shadowban'];
      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.audience(
        {
          body: {
            format: 'csv',
            locationText: 'Berlin (Germany)',
            sources: ['living', 'from'],
          },
        },
        res,
      );

      res.headers['Content-Type'].should.equal('text/csv');
      res.body.should.match(/living@example.com/);
      res.body.should.match(/origin@example.com/);
      res.body.should.not.match(/other@example.com/);
      res.body.should.not.match(/restricted@example.com/);
    });

    it('combines any selected circle with a location match', async () => {
      const matchingCircle = new mongoose.Types.ObjectId();
      const otherCircle = new mongoose.Types.ObjectId();
      const _users = utils.generateUsers(3, {
        public: true,
        newsletter: true,
      });
      _users[0].locationLiving = 'Berlin, Germany';
      _users[0].member = [{ tribe: matchingCircle, since: new Date() }];
      _users[1].locationLiving = 'Berlin, Germany';
      _users[1].member = [{ tribe: otherCircle, since: new Date() }];
      _users[2].locationLiving = 'Lisbon, Portugal';
      _users[2].member = [{ tribe: matchingCircle, since: new Date() }];
      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.audience(
        {
          body: {
            circleIds: [matchingCircle.toString()],
            locationText: 'Berlin',
            sources: ['living'],
          },
        },
        res,
      );

      res.body.should.deepEqual({ count: 1 });
    });

    it('builds an audience from circles without location criteria', async () => {
      const matchingCircle = new mongoose.Types.ObjectId();
      const _users = utils.generateUsers(2, {
        public: true,
        newsletter: true,
      });
      _users[0].member = [{ tribe: matchingCircle, since: new Date() }];
      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.audience(
        {
          body: {
            circleIds: [matchingCircle.toString()],
          },
        },
        res,
      );

      res.body.should.deepEqual({ count: 1 });
    });

    it('matches current hosting offers inside the requested radius', async () => {
      const _users = await utils.saveUsers(
        utils.generateUsers(4, {
          public: true,
          newsletter: true,
        }),
      );
      await Offer.create([
        {
          location: [52.51, 13.4],
          status: 'yes',
          type: 'host',
          user: _users[0]._id,
        },
        {
          location: [52.52, 13.41],
          status: 'maybe',
          type: 'host',
          user: _users[1]._id,
        },
        {
          location: [52.52, 13.41],
          status: 'no',
          type: 'host',
          user: _users[2]._id,
        },
        {
          location: [52.52, 13.41],
          type: 'host',
          user: _users[3]._id,
          validUntil: new Date(Date.now() - 60 * 1000),
        },
      ]);

      const res = mockResponse();
      await adminNewsletter.audience(
        {
          body: {
            ...berlin,
            sources: ['hosting'],
          },
        },
        res,
      );

      res.body.should.deepEqual({ count: 2 });
    });

    [
      {
        body: {},
        message: 'Choose at least one location source or circle.',
      },
      {
        body: { format: 'xml', sources: ['living'] },
        message: 'Choose preview or CSV audience output.',
      },
      {
        body: { sources: ['somewhere'] },
        message: 'Choose valid newsletter location sources.',
      },
      {
        body: { sources: ['living'] },
        message: 'Enter a location for living or origin matching.',
      },
      {
        body: {
          latitude: 91,
          longitude: 13.405,
          radiusKm: 50,
          sources: ['hosting'],
        },
        message: 'Enter valid latitude and longitude for hosting matching.',
      },
      {
        body: {
          ...berlin,
          radiusKm: 501,
          sources: ['hosting'],
        },
        message: 'Enter a hosting radius between 0 and 500 kilometres.',
      },
      {
        body: { circleIds: ['invalid'] },
        message: 'Choose valid newsletter circles.',
      },
    ].forEach(({ body, message }) => {
      it(`rejects invalid criteria: ${message}`, async () => {
        const res = mockResponse();
        await adminNewsletter.audience({ body }, res);

        res.statusCode.should.equal(400);
        res.body.message.should.equal(message);
      });
    });

    it('rejects a request without a body', async () => {
      const res = mockResponse();
      await adminNewsletter.audience({}, res);

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Choose at least one location source or circle.',
      );
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
        'Could not find any email addresses in the uploaded file.',
      );
    });

    it('extracts unique emails from JSONL strings and supported object fields', async () => {
      const _users = utils.generateUsers(1, {
        public: true,
        newsletter: true,
      });
      _users[0].email = 'eligible@example.com';
      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(
              [
                '\uFEFF{"email":"eligible@example.com"}',
                '{"emailAddress":"missing-one@example.com"}',
                '{"address":"missing-two@example.com"}',
                '"missing-three@example.com"',
                '{"email":"ELIGIBLE@example.com"}',
                '{"name":"No email"}',
                '',
              ].join('\n'),
            ),
            mimetype: 'application/x-ndjson',
            originalname: 'recipients.jsonl',
          },
        },
        res,
      );

      res.statusCode.should.equal(200);
      res.body.outputFormat.should.equal('jsonl');
      res.body.totalEmailCount.should.equal(4);
      res.body.subscribedCount.should.equal(1);
      res.body.unsubscribedCount.should.equal(3);
      JSON.parse(res.body.subscribedContent).email.should.equal(
        'eligible@example.com',
      );
      res.body.unsubscribedContent.should.match(/missing-one@example.com/);
      res.body.unsubscribedContent.should.match(/missing-two@example.com/);
      res.body.unsubscribedContent.should.match(/missing-three@example.com/);
      res.body.unsubscribedContent.should.match(/"reason":"Email not found"/);
    });

    it('rejects malformed NDJSON without returning partial results', async () => {
      const res = mockResponse();

      await adminNewsletter.splitSubscribers(
        {
          file: {
            buffer: Buffer.from(
              '{"email":"valid@example.com"}\n{"email":"broken@example.com"',
            ),
            mimetype: 'application/ndjson',
            originalname: 'recipients.ndjson',
          },
        },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal('Could not parse JSON on line 2.');
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
      res.body.outputFormat.should.equal('csv');
      res.body.subscribedCount.should.equal(1);
      res.body.unsubscribedCount.should.equal(5);
      res.body.subscribedContent.should.equal(
        'Email Address,First Name,Last Name\nsubscribed@example.com,Subscribed,Member',
      );
      res.body.unsubscribedContent.should.equal(
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
