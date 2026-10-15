/**
 * Unit tests for the admin newsletter controller.
 *
 * These handlers are exercised directly against the test database.
 */
import type { OfferRecord } from '../../../../testutils/server/model-contracts.mts';

import type { Types } from 'mongoose';
import type {
  GenerateUserOptions,
  ServerUserFixture,
} from '../../../../testutils/common/data.common.testutil.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
interface NewsletterRequest {
  query?: Record<string, unknown>;
  body?: unknown;
  file?: { buffer: Buffer; mimetype?: string; originalname?: string };
}
interface NewsletterPayload {
  message?: string;
  count?: number;
  outputFormat?: 'csv' | 'jsonl';
  totalEmailCount?: number;
  subscribedCount?: number;
  unsubscribedCount?: number;
  subscribedContent?: string;
  unsubscribedContent?: string;
}
type NewsletterBody = string | NewsletterPayload;
type NewsletterUserFixture = ServerUserFixture & {
  member?: Array<{ tribe: Types.ObjectId; since: Date }>;
  locationLiving?: string;
  locationFrom?: string;
  removeProfileToken?: string;
  removeProfileExpires?: Date;
};
interface MockResponse {
  statusCode: number;
  body: NewsletterBody;
  headers: Record<string, string>;
  status(code: number): this;
  set(name: string, value: string): this;
  send(body: NewsletterBody): this;
}
type Handler = (req: NewsletterRequest, res: MockResponse) => Promise<unknown>;
interface NewsletterController {
  list: Handler;
  listCircleMembers: Handler;
  audience: Handler;
  splitSubscribers: Handler;
}
const adminNewsletter: NewsletterController = require('../../server/controllers/admin.newsletter.server.controller.mts');
const errorService: typeof import('../../../core/server/services/error.server.service.mjs') = require('../../../core/server/services/error.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
require('should');

function generateNewsletterUsers(
  count: number,
  options?: GenerateUserOptions,
): NewsletterUserFixture[] {
  return utils.generateUsers(count, options, 'server');
}

const Offer = mongoose.model<OfferRecord>('Offer');

/**
 * Minimal Express-like response mock that records what the controller sends
 * back without needing the full HTTP stack.
 */
function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: '',
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(body: NewsletterBody) {
      this.body = body;
      return this;
    },
  };
  return res;
}
function responseText(res: MockResponse): string {
  if (typeof res.body !== 'string') throw new Error('Expected a text response');
  return res.body;
}
function responseData(res: MockResponse): NewsletterPayload {
  if (typeof res.body !== 'object' || res.body === null)
    throw new Error('Expected a data response');
  return res.body;
}

describe('Admin newsletter controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('list', () => {
    it('returns CSV with only email-eligible newsletter subscribers', async () => {
      const _users = generateNewsletterUsers(5, {
        public: true,
        newsletter: true,
      });
      // Public, but not subscribed to the newsletter
      _users[1].newsletter = false;
      // Subscribed, but not a public (confirmed) profile
      _users[2].public = false;
      // Subscribed, but suspended
      _users[3].roles = ['user', 'suspended'];
      // Subscribed, but pending profile deletion
      _users[4].removeProfileToken = 'remove-token';
      _users[4].removeProfileExpires = new Date(Date.now() + 3600 * 1000);

      _users[0].email = 'subscriber@example.com';
      _users[0].firstName = 'Alice';
      _users[0].lastName = 'Anderson';

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.list({}, res);

      res.headers['Content-Type'].should.equal('text/csv');

      const lines = responseText(res).split('\n');
      lines[0].should.equal('Email Address,First Name,Last Name');
      // Only the single eligible user should be present
      lines.length.should.equal(2);
      lines[1].should.equal('subscriber@example.com,Alice,Anderson');
    });

    it('strips characters that would break CSV files', async () => {
      const _users = generateNewsletterUsers(1, {
        public: true,
        newsletter: true,
      });
      _users[0].email = 'comma@example.com';
      _users[0].firstName = "Bob's";
      _users[0].lastName = 'Smith, "Jr"';

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.list({}, res);

      const lines = responseText(res).split('\n');
      lines[1].should.equal('comma@example.com,Bobs,Smith Jr');
    });

    it('returns only the header when there are no subscribers', async () => {
      const res = mockResponse();
      await adminNewsletter.list({}, res);

      res.headers['Content-Type'].should.equal('text/csv');
      responseText(res).should.equal('Email Address,First Name,Last Name');
    });
  });

  describe('listCircleMembers', () => {
    const circleId = '5fbab4f7fed63c7ed73276d3';

    it('responds with 400 when circleId is missing', async () => {
      const res = mockResponse();
      await adminNewsletter.listCircleMembers({ query: {} }, res);

      res.statusCode.should.equal(400);
      responseData(res).message!.should.equal(
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
      responseData(res).message!.should.equal(
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

      const _users = generateNewsletterUsers(4, { public: true });
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
      _users[3].removeProfileExpires = new Date(Date.now() + 3600 * 1000);

      await utils.saveUsers(_users);

      const res = mockResponse();
      await adminNewsletter.listCircleMembers({ query: { circleId } }, res);

      res.headers['Content-Type'].should.equal('text/csv');

      const lines = responseText(res).split('\n');
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

      const _users = generateNewsletterUsers(2, { public: true });
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

      const lines = responseText(res).split('\n');
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
      const _users = generateNewsletterUsers(4, {
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
      responseText(res).should.match(/living@example.com/);
      responseText(res).should.match(/origin@example.com/);
      responseText(res).should.not.match(/other@example.com/);
      responseText(res).should.not.match(/restricted@example.com/);
    });

    it('combines any selected circle with a location match', async () => {
      const matchingCircle = new mongoose.Types.ObjectId();
      const otherCircle = new mongoose.Types.ObjectId();
      const _users = generateNewsletterUsers(3, {
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

      responseData(res).should.deepEqual({ count: 1 });
    });

    it('builds an audience from circles without location criteria', async () => {
      const matchingCircle = new mongoose.Types.ObjectId();
      const _users = generateNewsletterUsers(2, {
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

      responseData(res).should.deepEqual({ count: 1 });
    });

    it('matches current hosting offers inside the requested radius', async () => {
      const _users = await utils.saveUsers(
        generateNewsletterUsers(4, {
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

      responseData(res).should.deepEqual({ count: 2 });
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
        responseData(res).message!.should.equal(message);
      });
    });

    it('rejects a request without a body', async () => {
      const res = mockResponse();
      await adminNewsletter.audience({}, res);

      res.statusCode.should.equal(400);
      responseData(res).message!.should.equal(
        'Choose at least one location source or circle.',
      );
    });

    it('accepts ObjectId-like circle identifiers supported by Mongoose', async () => {
      const circleId = new mongoose.Types.ObjectId();
      const res = mockResponse();
      await adminNewsletter.audience(
        {
          body: {
            circleIds: [
              {
                id: circleId.id,
                toHexString: () => circleId.toHexString(),
              },
            ],
          },
        },
        res,
      );
      responseData(res).count!.should.equal(0);
    });
  });

  describe('splitSubscribers', () => {
    it('responds with 422 when no CSV upload is present', async () => {
      const res = mockResponse();

      await adminNewsletter.splitSubscribers({}, res);

      res.statusCode.should.equal(422);
      responseData(res).message!.should.equal(
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
      responseData(res).message!.should.equal(
        'Could not find any email addresses in the uploaded file.',
      );
    });

    it('extracts unique emails from JSONL strings and supported object fields', async () => {
      const _users = generateNewsletterUsers(1, {
        public: true,
        newsletter: true,
      });
      _users[0].email = 'eligible@example.com';
      _users[0].firstName = 'Eligible';
      _users[0].lastName = 'Member';
      _users[0].username = 'eligiblemember';
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
                'null',
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
      responseData(res).outputFormat!.should.equal('jsonl');
      responseData(res).totalEmailCount!.should.equal(4);
      responseData(res).subscribedCount!.should.equal(1);
      responseData(res).unsubscribedCount!.should.equal(3);
      JSON.parse(responseData(res).subscribedContent!).should.containDeep({
        displayName: 'Eligible Member',
        email: 'eligible@example.com',
        username: 'eligiblemember',
      });
      responseData(res).unsubscribedContent!.should.match(
        /missing-one@example.com/,
      );
      responseData(res).unsubscribedContent!.should.match(
        /missing-two@example.com/,
      );
      responseData(res).unsubscribedContent!.should.match(
        /missing-three@example.com/,
      );
      responseData(res).unsubscribedContent!.should.match(
        /"reason":"Email not found"/,
      );
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
      responseData(res).message!.should.equal(
        'Could not parse JSON on line 2.',
      );
    });

    it('splits uploaded recipients into subscribed and unsubscribed CSV files', async () => {
      const _users = generateNewsletterUsers(5, {
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
      _users[4].removeProfileExpires = new Date(Date.now() + 3600 * 1000);

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
      responseData(res).totalEmailCount!.should.equal(6);
      responseData(res).outputFormat!.should.equal('csv');
      responseData(res).subscribedCount!.should.equal(1);
      responseData(res).unsubscribedCount!.should.equal(5);
      responseData(res).subscribedContent!.should.equal(
        'Email Address,First Name,Last Name\nsubscribed@example.com,Subscribed,Member',
      );
      responseData(res).unsubscribedContent!.should.equal(
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
