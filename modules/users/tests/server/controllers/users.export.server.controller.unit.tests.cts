const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
require('should');

const path: typeof import('node:path') = require('node:path');
const config: {
  files: { server: { models: string[] } };
} = require('./../../../../../config/config.mts');
config.files.server.models.forEach(modelPath =>
  require(path.resolve(modelPath)),
);
const mongoose: typeof import('mongoose') = require('mongoose');

type ExportRecord = Record<string, unknown>;
interface ExportProfile {
  username?: string;
  displayName?: string;
  member?: Array<{
    since?: string;
    tribe?: string | { _id?: unknown; slug?: string; label?: string };
  }>;
  [key: string]: unknown;
}
interface ExportCircle {
  _id: unknown;
  slug?: string;
  label?: string;
  since?: string;
}
interface ExportRequest {
  user: { _id: string; username: string };
  profile?: ExportProfile;
  contacts?: ExportRecord[];
}
interface ExportBody {
  format: string;
  version: number;
  exportedAt: string;
  profile: ExportProfile | Record<string, never>;
  circles: ExportCircle[];
  contacts: ExportRecord[];
  hostingOffers: ExportRecord[];
  messages: ExportRecord[];
  experiences: ExportRecord[];
}
interface MockResponse {
  body: ExportBody | null;
  contentType: string | null;
  filename: string | null;
  type(value: string): this;
  attachment(value: string): this;
  send(value: ExportBody): this;
}
interface MiddlewareResponse {
  status(code: number): { send(body: unknown): unknown };
}
type Middleware = (
  request: ExportRequest,
  response: MiddlewareResponse,
  next: (error?: unknown) => void,
  value?: string,
) => void;
const contactsService: {
  contactListByUser: Middleware;
} = require('./../../../../contacts/server/controllers/contacts.server.controller.mjs');
const profilesService: {
  userByUsername: Middleware;
} = require('./../../../server/controllers/users.profile.server.controller.mjs');
const controller: {
  buildExportFilename(username: string, exportedAt: Date): string;
  circlesFromProfile(profile: ExportProfile | null): ExportCircle[];
  writtenMessages(userId: string): Promise<ExportRecord[]>;
  writtenExperiences(userId: string): Promise<ExportRecord[]>;
  memberOffers(userId: string): Promise<ExportRecord[]>;
  download(
    request: ExportRequest,
    response: MockResponse,
    next: (error?: unknown) => void,
  ): Promise<void>;
} = require('./../../../server/controllers/users.export.server.controller.mjs');

function loadController({
  profile,
  contacts,
  messages = [],
  experiences = [],
  offers = [],
  offersError,
}: {
  profile: Middleware;
  contacts: Middleware;
  messages?: ExportRecord[];
  experiences?: ExportRecord[];
  offers?: ExportRecord[];
  offersError?: Error;
}): typeof controller {
  sinon.stub(profilesService, 'userByUsername').callsFake(profile);
  sinon.stub(contactsService, 'contactListByUser').callsFake(contacts);
  sinon.stub(controller, 'writtenMessages').resolves(messages);
  sinon.stub(controller, 'writtenExperiences').resolves(experiences);
  const offersStub = sinon.stub(controller, 'memberOffers').resolves(offers);
  if (offersError) offersStub.rejects(offersError);
  return controller;
}

interface TestQuery {
  query: ReturnType<import('mongoose').Model<ExportRecord>['find']>;
  sort: import('sinon').SinonStub;
  populate: import('sinon').SinonStub;
}
function resolvableQuery(
  model: import('mongoose').Model<ExportRecord>,
  result: ExportRecord[],
): TestQuery {
  const query = model.find({});
  const sort = sinon.stub(query, 'sort').returns(query);
  const populate = sinon.stub(query, 'populate').returns(query);
  sinon.stub(query, 'lean').resolves(result);
  return { query, sort, populate };
}

function mockResponse(): MockResponse {
  const response: MockResponse = {
    body: null,
    contentType: null,
    filename: null,
    type(value) {
      response.contentType = value;
      return response;
    },
    attachment(value) {
      response.filename = value;
      return response;
    },
    send(value) {
      response.body = value;
      return response;
    },
  };
  sinon.stub(response, 'type').callsFake(value => {
    response.contentType = value;
    return response;
  });
  sinon.stub(response, 'attachment').callsFake(value => {
    response.filename = value;
    return response;
  });
  sinon.stub(response, 'send').callsFake(value => {
    response.body = value;
    return response;
  });
  return response;
}

function responseBody(response: MockResponse): ExportBody {
  if (!response.body) throw new Error('expected the controller to send a body');
  return response.body;
}

describe('Member data export controller', () => {
  const user = { _id: 'member-id', username: 'member' };
  const exportedAt = new Date('2026-10-14T09:31:00.000Z');

  afterEach(() => sinon.restore());

  it('returns the current member’s sanitised profile, contacts, and offers', async () => {
    sinon.useFakeTimers(exportedAt);
    const profile: Middleware = (req, _res, next, username) => {
      assert.equal(username, user.username);
      req.profile = {
        username,
        displayName: 'Member Example',
        member: [
          {
            since: '2020-01-01T00:00:00.000Z',
            tribe: { _id: 'circle-1', slug: 'hikers', label: 'Hikers' },
          },
          { since: '2020-02-01T00:00:00.000Z' },
        ],
      };
      next();
    };
    const contacts: Middleware = (req, _res, next, userId) => {
      assert.equal(userId, user._id);
      req.contacts = [{ displayName: 'Contact Example' }];
      next();
    };
    const controller = loadController({
      profile,
      contacts,
      messages: [{ _id: 'message-1', content: 'Hello' }],
      experiences: [{ _id: 'experience-1', recommend: 'yes' }],
      offers: [
        {
          _id: 'offer-1',
          type: 'host',
          validUntil: '2020-01-01T00:00:00.000Z',
        },
      ],
    });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    response.contentType!.should.equal('application/json');
    response.filename!.should.equal(
      'trustroots-data-member-20261014-0931.json',
    );
    responseBody(response).should.containEql({
      format: 'trustroots-data-export',
      version: 2,
      exportedAt: '2026-10-14T09:31:00.000Z',
      profile: {
        username: user.username,
        displayName: 'Member Example',
        member: [
          {
            since: '2020-01-01T00:00:00.000Z',
            tribe: { _id: 'circle-1', slug: 'hikers', label: 'Hikers' },
          },
          { since: '2020-02-01T00:00:00.000Z' },
        ],
      },
      circles: [
        {
          _id: 'circle-1',
          slug: 'hikers',
          label: 'Hikers',
          since: '2020-01-01T00:00:00.000Z',
        },
      ],
      contacts: [{ displayName: 'Contact Example' }],
      hostingOffers: [
        {
          _id: 'offer-1',
          type: 'host',
          validUntil: '2020-01-01T00:00:00.000Z',
        },
      ],
      messages: [{ _id: 'message-1', content: 'Hello' }],
      experiences: [{ _id: 'experience-1', recommend: 'yes' }],
    });
  });

  it('names the file with a lowercase username and UTC time', async () => {
    sinon.useFakeTimers(exportedAt);
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
    });
    const response = mockResponse();

    await controller.download(
      { user: { ...user, username: 'Good.Name-1' } },
      response,
      sinon.stub(),
    );

    response.filename!.should.equal(
      'trustroots-data-good.name-1-20261014-0931.json',
    );
  });

  it('omits a username that is not safe in a filename', async () => {
    sinon.useFakeTimers(exportedAt);
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
    });
    const response = mockResponse();

    await controller.download(
      { user: { ...user, username: '../etc' } },
      response,
      sinon.stub(),
    );

    response.filename!.should.equal('trustroots-data-20261014-0931.json');

    const missingUsername = mockResponse();
    await controller.download(
      { user: { ...user, username: '' } },
      missingUsername,
      sinon.stub(),
    );

    missingUsername.filename!.should.equal(
      'trustroots-data-20261014-0931.json',
    );
  });

  it('returns empty lists when the member has no extra records', async () => {
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
    });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    const body = responseBody(response);
    body.circles.should.deepEqual([]);
    body.hostingOffers.should.deepEqual([]);
    body.messages.should.deepEqual([]);
    body.experiences.should.deepEqual([]);
  });

  it('lists circles from populated and id-only memberships', () => {
    controller
      .circlesFromProfile({
        member: [
          {
            since: '2020-01-01T00:00:00.000Z',
            tribe: { _id: 'circle-1', slug: 'hikers', label: 'Hikers' },
          },
          { since: '2020-02-01T00:00:00.000Z', tribe: 'circle-2' },
          {
            since: '2020-03-01T00:00:00.000Z',
            tribe: { slug: 'circle-without-id', label: 'Fallback Circle' },
          },
          { since: '2020-04-01T00:00:00.000Z' },
        ],
      })
      .should.deepEqual([
        {
          _id: 'circle-1',
          slug: 'hikers',
          label: 'Hikers',
          since: '2020-01-01T00:00:00.000Z',
        },
        { _id: 'circle-2', since: '2020-02-01T00:00:00.000Z' },
        {
          _id: { slug: 'circle-without-id', label: 'Fallback Circle' },
          slug: 'circle-without-id',
          label: 'Fallback Circle',
          since: '2020-03-01T00:00:00.000Z',
        },
      ]);
    controller.circlesFromProfile(null).should.deepEqual([]);
  });

  it('exports messages and experiences the member wrote', async () => {
    const messageModel = mongoose.model<ExportRecord>('Message');
    const messageQuery = resolvableQuery(messageModel, [
      {
        _id: 'message-1',
        created: '2024-01-01T00:00:00.000Z',
        content: 'Hello',
        read: true,
        userTo: {
          _id: 'recipient-1',
          username: 'bob',
          displayName: 'Bob Example',
          email: 'bob@example.test',
        },
        notificationCount: 4,
      },
      {
        _id: 'message-2',
        created: '2024-01-02T00:00:00.000Z',
        content: 'Still here',
        read: false,
        userTo: 'recipient-2',
      },
      {
        _id: 'message-3',
        created: '2024-01-03T00:00:00.000Z',
        content: 'A concise reply',
        read: true,
        userTo: { _id: 'recipient-3' },
      },
    ]);
    const experienceModel = mongoose.model<ExportRecord>('Experience');
    const experienceQuery = resolvableQuery(experienceModel, [
      {
        _id: 'experience-1',
        created: '2024-02-01T00:00:00.000Z',
        public: false,
        interactions: { met: true, guest: false, host: true },
        recommend: 'yes',
        feedbackPublic: 'A good stay',
        removedAt: '2024-03-01T00:00:00.000Z',
        userTo: { _id: 'recipient-1', username: 'bob' },
      },
      {
        _id: 'experience-2',
        created: '2024-02-02T00:00:00.000Z',
        public: true,
        recommend: 'unknown',
        userTo: null,
      },
    ]);
    const findMessages = sinon
      .stub(messageModel, 'find')
      .returns(messageQuery.query);
    const findExperiences = sinon
      .stub(experienceModel, 'find')
      .returns(experienceQuery.query);

    const messages = await controller.writtenMessages(user._id);
    const experiences = await controller.writtenExperiences(user._id);

    assert.deepEqual(findMessages.firstCall.args[0], { userFrom: user._id });
    assert.deepEqual(findExperiences.firstCall.args[0], { userFrom: user._id });
    messageQuery.sort.calledWith({ created: 1 }).should.be.true();
    messageQuery.populate
      .calledWith('userTo', 'username displayName')
      .should.be.true();
    messages.should.deepEqual([
      {
        _id: 'message-1',
        created: '2024-01-01T00:00:00.000Z',
        content: 'Hello',
        read: true,
        userTo: {
          _id: 'recipient-1',
          username: 'bob',
          displayName: 'Bob Example',
        },
      },
      {
        _id: 'message-2',
        created: '2024-01-02T00:00:00.000Z',
        content: 'Still here',
        read: false,
        userTo: 'recipient-2',
      },
      {
        _id: 'message-3',
        created: '2024-01-03T00:00:00.000Z',
        content: 'A concise reply',
        read: true,
        userTo: { _id: 'recipient-3' },
      },
    ]);
    experiences.should.deepEqual([
      {
        _id: 'experience-1',
        created: '2024-02-01T00:00:00.000Z',
        public: false,
        interactions: { met: true, guest: false, host: true },
        recommend: 'yes',
        feedbackPublic: 'A good stay',
        removedAt: '2024-03-01T00:00:00.000Z',
        userTo: { _id: 'recipient-1', username: 'bob' },
      },
      {
        _id: 'experience-2',
        created: '2024-02-02T00:00:00.000Z',
        public: true,
        interactions: { met: false, guest: false, host: false },
        recommend: 'unknown',
        userTo: null,
      },
    ]);
  });

  it('exports every stored offer, including expired ones', async () => {
    const offerModel = mongoose.model<ExportRecord>('Offer');
    const offerQuery = resolvableQuery(offerModel, [
      {
        _id: 'offer-1',
        type: 'host',
        user: user._id,
        location: [52.1, 4.3],
        status: 'active',
        locationFuzzy: [52.2, 4.4],
        description: 'Guest bed',
        noOfferDescription: 'A quiet place to rest',
        maxGuests: 2,
        updated: '2019-12-01T00:00:00.000Z',
        validUntil: '2020-01-01T00:00:00.000Z',
        showOnlyInMyCircles: true,
        createdAt: '2019-01-01T00:00:00.000Z',
        reactivateReminderSent: '2019-06-01T00:00:00.000Z',
      },
      {
        _id: 'offer-2',
        type: 'host',
        user: user._id,
        location: [48.1, 11.5],
      },
    ]);
    const find = sinon.stub(offerModel, 'find').returns(offerQuery.query);

    const offers = await controller.memberOffers(user._id);

    find.calledOnce.should.be.true();
    find.firstCall.args.should.deepEqual([{ user: user._id }]);
    offerQuery.sort.calledWith({ createdAt: 1 }).should.be.true();
    offers.should.deepEqual([
      {
        _id: 'offer-1',
        type: 'host',
        user: user._id,
        location: [52.1, 4.3],
        status: 'active',
        description: 'Guest bed',
        noOfferDescription: 'A quiet place to rest',
        maxGuests: 2,
        updated: '2019-12-01T00:00:00.000Z',
        validUntil: '2020-01-01T00:00:00.000Z',
        showOnlyInMyCircles: true,
        createdAt: '2019-01-01T00:00:00.000Z',
      },
      {
        _id: 'offer-2',
        type: 'host',
        user: user._id,
        location: [48.1, 11.5],
      },
    ]);
  });

  it('passes unexpected export errors to the error handler', async () => {
    const error = new Error('database unavailable');
    const next = sinon.stub();
    const controller = loadController({
      profile: (req, res, callback) => callback(error),
      contacts: sinon.stub(),
    });

    await controller.download({ user: { ...user } }, mockResponse(), next);

    next.calledWith(error).should.be.true();
  });

  it('passes unexpected hosting-offer errors to the error handler', async () => {
    const error = new Error('offers unavailable');
    const next = sinon.stub();
    const controller = loadController({
      profile: (req, res, callback) => callback(),
      contacts: (req, res, callback) => callback(),
      offersError: error,
    });

    await controller.download({ user: { ...user } }, mockResponse(), next);

    next.calledWith(error).should.be.true();
  });

  it('passes profile middleware response errors to the error handler', async () => {
    const next = sinon.stub();
    const controller = loadController({
      profile: (_req, response) => {
        response.status(404).send({ message: 'Profile unavailable' });
      },
      contacts: sinon.stub(),
    });

    await controller.download({ user: { ...user } }, mockResponse(), next);

    const error = next.firstCall.args[0] as Error & { statusCode: number };
    assert.equal(error.message, 'Profile unavailable');
    assert.equal(error.statusCode, 404);
  });

  it('passes contact middleware response errors without a message to the error handler', async () => {
    const next = sinon.stub();
    const controller = loadController({
      profile: (_req, _response, callback) => callback(),
      contacts: (_req, response) => {
        response.status(403).send({});
      },
    });

    await controller.download({ user: { ...user } }, mockResponse(), next);

    const error = next.firstCall.args[0] as Error & { statusCode: number };
    assert.equal(error.message, '');
    assert.equal(error.statusCode, 403);
  });
});
