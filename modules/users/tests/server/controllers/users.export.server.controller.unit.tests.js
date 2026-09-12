const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
require('should');

const controllerPath =
  '../../../server/controllers/users.export.server.controller';

function loadController({ profile, contacts, offers }) {
  return proxyquire(controllerPath, {
    '../../../contacts/server/controllers/contacts.server.controller': {
      contactListByUser: contacts,
    },
    '../../../offers/server/controllers/offers.server.controller': {
      offersByUserId: offers,
    },
    './users.profile.server.controller': { userByUsername: profile },
  });
}

function mockResponse() {
  const response = { body: null, contentType: null, filename: null };
  response.type = sinon.stub().callsFake(type => {
    response.contentType = type;
    return response;
  });
  response.attachment = sinon.stub().callsFake(filename => {
    response.filename = filename;
    return response;
  });
  response.send = sinon.stub().callsFake(body => {
    response.body = body;
    return response;
  });
  return response;
}

describe('Member data export controller', () => {
  const user = { _id: 'member-id', username: 'member' };

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

    response.contentType.should.equal('application/json');
    response.filename.should.equal(controller.EXPORT_FILENAME);
    response.body.should.containEql({
      format: 'trustroots-data-export',
      version: 1,
      profile: { username: user.username, displayName: 'Member Example' },
      contacts: [{ displayName: 'Contact Example' }],
      hostingOffers: [{ title: 'Guest bed' }],
    });
    new Date(response.body.exportedAt)
      .toISOString()
      .should.equal(response.body.exportedAt);
  });

  it('returns an empty hosting offer list when the member has no offers', async () => {
    const notFound = () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      return error;
    };
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res) => res.status(404).send(notFound()),
    });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    response.body.hostingOffers.should.deepEqual([]);
  });

  it('defaults to an empty hosting offer list when middleware returns no list', async () => {
    const controller = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();

    await controller.download({ user: { ...user } }, response, sinon.stub());

    response.body.hostingOffers.should.deepEqual([]);
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
