require('should');
const mongoose = require('mongoose');
const sinon = require('sinon');
const config = require('../../../../config/config.mts');
const {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
} = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');

require('../../server/models/user.server.model.mjs');
const User = mongoose.model('User');
const nostrController = require('../../server/controllers/users.nostr.server.controller.mjs');
const validNsec =
  'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav';

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(body) {
        this.body = body;
        resolve(this);
        return this;
      },
      json(body) {
        this.body = body;
        resolve(this);
        return this;
      },
      sendStatus(code) {
        this.statusCode = code;
        resolve(this);
        return this;
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

function createProof(secretKey, tags, overrides = {}) {
  return finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags,
      ...overrides,
    },
    secretKey,
  );
}

describe('Nostr proof controller', () => {
  afterEach(() => sinon.restore());

  it('requires an authenticated member and a valid saved key for challenge issuance', async () => {
    const unauthenticated = await invoke(nostrController.challenge, {});
    unauthenticated.statusCode.should.equal(403);

    for (const nostrNpub of [undefined, validNsec, 'invalid']) {
      const response = await invoke(nostrController.challenge, {
        user: { _id: new mongoose.Types.ObjectId(), nostrNpub },
      });
      response.statusCode.should.equal(400);
    }
  });

  it('issues a canonical HTTPS NIP-98 template and rotates challenge state', async () => {
    const { https } = config;
    config.https = true;
    const secretKey = generateSecretKey();
    const npub = nip19.npubEncode(getPublicKey(secretKey));
    const findOneAndUpdate = sinon.stub(User, 'findOneAndUpdate').resolves({});

    try {
      const response = await invoke(nostrController.challenge, {
        user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
      });

      response.statusCode.should.equal(200);
      response.body.event.kind.should.equal(27235);
      response.body.event.tags[0][1].should.equal(
        `https://${config.domain}/api/users/nostr/verify`,
      );
      response.body.event.tags[1].should.deepEqual(['method', 'POST']);
      response.body.event.tags[2][0].should.equal('challenge');
      response.body.expiresAt.should.be.a.String();
      findOneAndUpdate.calledOnce.should.be.true();
      findOneAndUpdate.firstCall.args[0].nostrNpub.should.equal(npub);
      findOneAndUpdate.firstCall.args[1].$set.nostrChallenge.should.equal(
        response.body.event.tags[2][1],
      );
    } finally {
      config.https = https;
    }
  });

  it('fails closed when challenge storage fails or the saved key changed', async () => {
    const secretKey = generateSecretKey();
    const npub = nip19.npubEncode(getPublicKey(secretKey));
    const req = {
      user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
    };

    sinon
      .stub(User, 'findOneAndUpdate')
      .rejects(new Error('storage unavailable'));
    (await invoke(nostrController.challenge, req)).statusCode.should.equal(503);

    sinon.restore();
    sinon.stub(User, 'findOneAndUpdate').resolves(null);
    (await invoke(nostrController.challenge, req)).statusCode.should.equal(400);
  });

  it('requires an authenticated member and rejects malformed or stale events', async () => {
    (await invoke(nostrController.verify, {})).statusCode.should.equal(403);
    (
      await invoke(nostrController.verify, { user: { nostrNpub: undefined } })
    ).statusCode.should.equal(400);

    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(pubkey);
    const tags = [
      ['u', `http://${config.domain}/api/users/nostr/verify`],
      ['method', 'POST'],
      ['challenge', 'nonce-value'],
    ];
    const validEvent = createProof(secretKey, tags);
    const req = {
      user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
    };

    const invalidEvents = [
      undefined,
      { ...validEvent, kind: 1 },
      { ...validEvent, content: 'unexpected' },
      { ...validEvent, created_at: 1.5 },
      { ...validEvent, pubkey: 'f'.repeat(64) },
      { ...validEvent, id: undefined },
      { ...validEvent, sig: undefined },
      { ...validEvent, created_at: 1 },
      { ...validEvent, sig: '0'.repeat(128) },
      { ...validEvent, tags: 'malformed' },
    ];
    for (const event of invalidEvents) {
      const response = await invoke(nostrController.verify, {
        ...req,
        body: { event },
      });
      response.statusCode.should.equal(400);
    }
  });

  it('rejects malformed, altered, duplicate, and extra NIP-98 tags', async () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(pubkey);
    const url = `http://${config.domain}/api/users/nostr/verify`;
    const goodTags = [
      ['u', url],
      ['method', 'POST'],
      ['challenge', 'nonce-value'],
    ];
    const invalidTags = [
      [],
      [
        ['u', url],
        ['method', 'POST'],
      ],
      [
        ['u', url],
        ['method', 'POST'],
        ['challenge', 'nonce-value'],
        ['extra', 'x'],
      ],
      [
        ['u', url],
        ['method', 'POST'],
        ['challenge', 'nonce-value', 'extra'],
      ],
      [['u', url], ['method', 'POST'], ['challenge']],
      [
        ['u', url],
        ['method', 'POST'],
        ['other', 'nonce-value'],
      ],
      [
        ['u', 'https://wrong.example/api/users/nostr/verify'],
        ['method', 'POST'],
        ['challenge', 'nonce-value'],
      ],
      [
        ['u', url],
        ['method', 'GET'],
        ['challenge', 'nonce-value'],
      ],
      [
        ['u', url],
        ['method', 'POST'],
        ['challenge', 'wrong-nonce'],
      ],
      [
        ['u', url],
        ['method', 'POST'],
        ['method', 'POST'],
      ],
      [
        ['u', url],
        ['challenge', 'nonce-value'],
        ['other', 'extra'],
      ],
    ];

    for (const tags of invalidTags) {
      const event = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags,
        pubkey,
        id: '0'.repeat(64),
        sig: '0'.repeat(128),
      };
      const response = await invoke(nostrController.verify, {
        user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
        body: { event },
      });
      response.statusCode.should.equal(400);
    }

    const validEvent = createProof(secretKey, goodTags);
    sinon
      .stub(User, 'findOneAndUpdate')
      .rejects(new Error('storage unavailable'));
    const unavailable = await invoke(nostrController.verify, {
      user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
      body: { event: validEvent },
    });
    unavailable.statusCode.should.equal(503);

    sinon.restore();
    sinon.stub(User, 'findOneAndUpdate').resolves(null);
    const consumed = await invoke(nostrController.verify, {
      user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
      body: { event: validEvent },
    });
    consumed.statusCode.should.equal(400);
  });

  it('writes verification and consumes the exact unexpired challenge atomically', async () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(pubkey);
    const nonce = 'nonce-value';
    const event = createProof(secretKey, [
      ['u', `http://${config.domain}/api/users/nostr/verify`],
      ['method', 'POST'],
      ['challenge', nonce],
    ]);
    const now = new Date();
    const returnedUser = {
      toObject: () => ({
        _id: new mongoose.Types.ObjectId(),
        displayName: 'Fictional Member',
        username: 'fictional-member',
        nostrNpub: npub,
        nostrVerifiedNpub: npub,
        nostrVerifiedAt: now,
        member: [],
        roles: ['user'],
      }),
    };
    const findOneAndUpdate = sinon
      .stub(User, 'findOneAndUpdate')
      .resolves(returnedUser);

    const response = await invoke(nostrController.verify, {
      user: { _id: new mongoose.Types.ObjectId(), nostrNpub: npub },
      body: { event },
    });

    response.statusCode.should.equal(200);
    response.body.nostrVerifiedAt.toISOString().should.equal(now.toISOString());
    findOneAndUpdate.firstCall.args[0].nostrNpub.should.equal(npub);
    findOneAndUpdate.firstCall.args[0].nostrChallenge.should.equal(nonce);
    findOneAndUpdate.firstCall.args[0].nostrChallengeExpiresAt.$gt.should.be.a.Date();
    findOneAndUpdate.firstCall.args[1].$set.nostrVerifiedNpub.should.equal(
      npub,
    );
    findOneAndUpdate.firstCall.args[1].$unset.nostrChallenge.should.equal(1);
  });
});
