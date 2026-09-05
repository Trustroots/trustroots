const { generateSecretKey, getPublicKey } = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');
const sinon = require('sinon');
const winston = require('winston');
require('should');

const path = require('path');
const config = require('./../../../../../config/config.mjs');
config.files.server.models.forEach(modelPath =>
  require(path.resolve(modelPath)),
);
const contactsService = require('./../../../../contacts/server/controllers/contacts.server.controller.mjs');
const offersService = require('./../../../../offers/server/controllers/offers.server.controller.mjs');
const profilesService = require('./../../../server/controllers/users.profile.server.controller.mjs');
const controller = require('./../../../server/controllers/users.export.server.controller.mjs');
const canonical = require('../../../server/services/data-export-canonical.server.service.mjs');
const verification = require('../../../server/services/data-export-verification.server.service.mjs');

const secretKey = generateSecretKey();
const signingPublicKey = getPublicKey(secretKey);
const originalNsec =
  (config.dataExportSigning && config.dataExportSigning.nsec) || '';

function setSigningNsec(nsec) {
  config.dataExportSigning = config.dataExportSigning || {};
  config.dataExportSigning.nsec = nsec;
}

function loadController({ profile, contacts, offers }) {
  sinon.stub(profilesService, 'userByUsername').callsFake(profile);
  sinon.stub(contactsService, 'contactListByUser').callsFake(contacts);
  sinon.stub(offersService, 'offersByUserId').callsFake(offers);
  return controller;
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

  afterEach(() => {
    sinon.restore();
    setSigningNsec(originalNsec);
  });

  it('returns the current member’s sanitised profile, contacts, and offers', async () => {
    setSigningNsec('');
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
    const loaded = loadController({ profile, contacts, offers });
    const response = mockResponse();

    await loaded.download({ user: { ...user } }, response, sinon.stub());

    response.contentType.should.equal('application/json');
    response.filename.should.equal(loaded.EXPORT_FILENAME);
    response.body.should.containEql({
      format: 'trustroots-data-export',
      version: 2,
      profile: { username: user.username, displayName: 'Member Example' },
      contacts: [{ displayName: 'Contact Example' }],
      hostingOffers: [{ title: 'Guest bed' }],
    });
    new Date(response.body.exportedAt)
      .toISOString()
      .should.equal(response.body.exportedAt);
  });

  it('returns an empty hosting offer list when the member has no offers', async () => {
    setSigningNsec('');
    const notFound = () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      return error;
    };
    const loaded = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res) => res.status(404).send(notFound()),
    });
    const response = mockResponse();

    await loaded.download({ user: { ...user } }, response, sinon.stub());

    response.body.hostingOffers.should.deepEqual([]);
  });

  it('defaults to an empty hosting offer list when middleware returns no list', async () => {
    setSigningNsec('');
    const loaded = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();

    await loaded.download({ user: { ...user } }, response, sinon.stub());

    response.body.hostingOffers.should.deepEqual([]);
  });

  it('passes unexpected export errors to the error handler', async () => {
    const error = new Error('database unavailable');
    const next = sinon.stub();
    const loaded = loadController({
      profile: (req, res, callback) => callback(error),
      contacts: sinon.stub(),
      offers: sinon.stub(),
    });

    await loaded.download({ user: { ...user } }, mockResponse(), next);

    next.calledWith(error).should.be.true();
  });

  it('passes unexpected hosting-offer errors to the error handler', async () => {
    const error = new Error('offers unavailable');
    const next = sinon.stub();
    const loaded = loadController({
      profile: (req, res, callback) => callback(),
      contacts: (req, res, callback) => callback(),
      offers: (req, res, callback) => callback(error),
    });

    await loaded.download({ user: { ...user } }, mockResponse(), next);

    next.calledWith(error).should.be.true();
  });

  it('serves an unsigned export and warns when no signing key is configured', async () => {
    setSigningNsec('');
    const winstonLog = sinon.stub(winston, 'log');
    const loaded = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();
    const next = sinon.stub();

    await loaded.download({ user: { ...user } }, response, next);

    next.called.should.be.false();
    (response.body.signature === null).should.be.true();
    winstonLog
      .calledWith('warn', sinon.match(/unsigned export/))
      .should.be.true();
  });

  it('signs the export so that the delivered file verifies', async () => {
    setSigningNsec(nip19.nsecEncode(secretKey));
    const loaded = loadController({
      profile: (req, res, next) => {
        req.profile = { username: user.username };
        next();
      },
      contacts: (req, res, next) => {
        req.contacts = [{ _id: 'contact-2' }, { _id: 'contact-1' }];
        next();
      },
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();

    await loaded.download({ user: { ...user } }, response, sinon.stub());

    const file = JSON.parse(JSON.stringify(response.body));
    const report = verification.verifyExport(file, {
      keyHistory: [{ pubkey: signingPublicKey, status: 'active' }],
    });

    report.valid.should.be.true();
    file.signature.event.pubkey.should.equal(signingPublicKey);
  });

  it('sends list sections in the order they were signed in', async () => {
    setSigningNsec(nip19.nsecEncode(secretKey));
    const loaded = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => {
        req.contacts = [{ _id: 'contact-2' }, { _id: 'contact-1' }];
        next();
      },
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();

    await loaded.download({ user: { ...user } }, response, sinon.stub());

    response.body.contacts.should.deepEqual([
      { _id: 'contact-1' },
      { _id: 'contact-2' },
    ]);
  });

  it('attests the same root for two downloads of unchanged data', async () => {
    setSigningNsec(nip19.nsecEncode(secretKey));
    const middlewares = {
      profile: (req, res, next) => {
        req.profile = { username: user.username };
        next();
      },
      contacts: (req, res, next) => {
        req.contacts = [{ _id: 'contact-1' }];
        next();
      },
      offers: (req, res, next) => next(),
    };
    const first = mockResponse();
    const second = mockResponse();

    await loadController(middlewares).download(
      { user: { ...user } },
      first,
      sinon.stub(),
    );
    sinon.restore();
    setSigningNsec(nip19.nsecEncode(secretKey));
    await loadController(middlewares).download(
      { user: { ...user } },
      second,
      sinon.stub(),
    );

    second.body.signature.root.should.equal(first.body.signature.root);
    canonical
      .canonicalise(canonical.buildSignedPayload(second.body))
      .should.equal(
        canonical.canonicalise(canonical.buildSignedPayload(first.body)),
      );
  });

  it('keeps the request timestamp out of the signed payload', async () => {
    setSigningNsec(nip19.nsecEncode(secretKey));
    const loaded = loadController({
      profile: (req, res, next) => next(),
      contacts: (req, res, next) => next(),
      offers: (req, res, next) => next(),
    });
    const response = mockResponse();

    await loaded.download({ user: { ...user } }, response, sinon.stub());

    response.body.signature.signed.should.not.containEql('exportedAt');
    canonical
      .buildSignedPayload(response.body)
      .should.not.have.property('exportedAt');
  });
});
