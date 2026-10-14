const sinon: typeof import('sinon') = require('sinon');
require('should');

const path: typeof import('node:path') = require('node:path');
const config: {
  files: { server: { models: string[] } };
} = require('./../../../../../config/config.mjs');
config.files.server.models.forEach(modelPath =>
  require(path.resolve(modelPath)),
);
interface ExportRequest {
  user: { _id: string; username: string };
  profile?: { username: string; displayName: string };
  contacts?: Array<{ displayName: string }>;
  offers?: Array<{ title: string }>;
}
interface ExportBody {
  format: string;
  version: number;
  exportedAt: string;
  profile: ExportRequest['profile'] | Record<string, never>;
  contacts: Array<{ displayName: string }>;
  hostingOffers: Array<{ title: string }>;
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
const offersService: {
  offersByUserId: Middleware;
} = require('./../../../../offers/server/controllers/offers.server.controller.mjs');
const profilesService: {
  userByUsername: Middleware;
} = require('./../../../server/controllers/users.profile.server.controller.mjs');
const controller: {
  EXPORT_FILENAME: string;
  download(
    request: ExportRequest,
    response: MockResponse,
    next: (error?: unknown) => void,
  ): Promise<void>;
} = require('./../../../server/controllers/users.export.server.controller.mjs');

function loadController({
  profile,
  contacts,
  offers,
}: {
  profile: Middleware;
  contacts: Middleware;
  offers: Middleware;
}): typeof controller {
  sinon.stub(profilesService, 'userByUsername').callsFake(profile);
  sinon.stub(contactsService, 'contactListByUser').callsFake(contacts);
  sinon.stub(offersService, 'offersByUserId').callsFake(offers);
  return controller;
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
  sinon.stub(response, 'attachment').callsFake(filename => {
    response.filename = filename;
    return response;
  });
  sinon.stub(response, 'send').callsFake(body => {
    response.body = body;
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

  afterEach(() => sinon.restore());

  it('returns the current member’s sanitised profile, contacts, and offers', async () => {
    const profile = sinon.stub().callsFake((req, res, next, username) => {
      username.should.equal(user.username);
      req.profile = { username, displayName: 'Member Example' };
      next();
    });
    const contacts = sinon.stub().callsFake((req, res, next, userId) => {
      userId.should.equal(user._id);
      req.contacts = [{ displayName: 'Contact Example' }];
      next();
    });
    const offers = sinon.stub().callsFake((req, res, next, userId) => {
      userId.should.equal(user._id);
      req.offers = [{ title: 'Guest bed' }];
      next();
    });
    const controller = loadController({ profile, contacts, offers });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    response.contentType!.should.equal('application/json');
    response.filename!.should.equal(controller.EXPORT_FILENAME);
    const body = responseBody(response);
    body.should.containEql({
      format: 'trustroots-data-export',
      version: 1,
      profile: { username: user.username, displayName: 'Member Example' },
      contacts: [{ displayName: 'Contact Example' }],
      hostingOffers: [{ title: 'Guest bed' }],
    });
    new Date(body.exportedAt).toISOString().should.equal(body.exportedAt);
  });

  it('returns an empty hosting offer list when the member has no offers', async () => {
    const notFound = () => {
      return Object.assign(new Error('Not found'), { statusCode: 404 });
    };
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res) => res.status(404).send(notFound()),
    });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    responseBody(response).hostingOffers.should.deepEqual([]);
  });

  it('defaults to an empty hosting offer list when middleware returns no list', async () => {
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    responseBody(response).hostingOffers.should.deepEqual([]);
  });

  it('passes unexpected export errors to the error handler', async () => {
    const error = new Error('database unavailable');
    const next = sinon.stub();
    const controller = loadController({
      profile: (req, res, callback) => callback(error),
      contacts: sinon.stub(),
      offers: sinon.stub(),
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
      offers: (req, res, callback) => callback(error),
    });

    await controller.download({ user: { ...user } }, mockResponse(), next);

    next.calledWith(error).should.be.true();
  });
});
