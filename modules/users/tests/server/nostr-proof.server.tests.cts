const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const {
  finalizeEvent,
  getPublicKey,
  nip19,
}: typeof import('nostr-tools') = require('nostr-tools');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
require('../../server/models/user.server.model.mjs');
const {
  createChallenge,
  consumeProof,
  decodeNpub,
}: typeof import('../../server/services/nostr-proof.server.service.mts') = require('../../server/services/nostr-proof.server.service.mts');
const {
  challenge,
}: typeof import('../../server/controllers/users.nostr.server.controller.mts') = require('../../server/controllers/users.nostr.server.controller.mts');
const profileController = require('../../server/controllers/users.profile.server.controller.mjs');
type UserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;
type UserModel =
  import('../../server/models/user.server.types.mts').UserServerModel;
const User = mongoose.model<UserRecord, UserModel>('User');
const key = new Uint8Array(32).fill(2);
const npub = nip19.npubEncode(getPublicKey(key));
const otherKey = new Uint8Array(32).fill(3);
const otherNpub = nip19.npubEncode(getPublicKey(otherKey));
let user: import('../../server/models/user.server.types.mts').UserServerDocument;

describe('Nostr ownership proofs', () => {
  it('binds proofs to the configured HTTPS endpoint', async () => {
    const previous = config.https;
    config.https = true;
    try {
      const event = await createChallenge(user._id, npub);
      event.tags[0][1].should.startWith('https://');
      (
        await consumeProof(user._id, npub, finalizeEvent(event, key))
      ).should.equal(true);
    } finally {
      config.https = previous;
    }
  });
  beforeEach(async () => {
    user = new User(utils.generateUsers(1)[0]);
    await user.save();
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  it('accepts a matching proof once and excludes challenges from ordinary queries', async () => {
    const event = await createChallenge(user._id, npub);
    const stored = await User.findById(user._id);
    should.not.exist(stored!.nostrChallenge);
    should.not.exist(stored!.nostrChallengeExpiresAt);
    const proof = finalizeEvent(event, key);
    (await consumeProof(user._id, npub, proof)).should.equal(true);
    (await consumeProof(user._id, npub, proof)).should.equal(false);
  });

  it('rejects expired, superseded, wrong-member and wrong-key challenges', async () => {
    const old = finalizeEvent(await createChallenge(user._id, npub), key);
    const proof = finalizeEvent(await createChallenge(user._id, npub), key);
    (await consumeProof(user._id, npub, old)).should.equal(false);
    (
      await consumeProof(new mongoose.Types.ObjectId(), npub, proof)
    ).should.equal(false);
    (
      await consumeProof(
        user._id,
        otherNpub,
        finalizeEvent({ ...proof }, otherKey),
      )
    ).should.equal(false);
    await User.updateOne(
      { _id: user._id },
      { $set: { nostrChallengeExpiresAt: new Date(0) } },
    );
    (await consumeProof(user._id, npub, proof)).should.equal(false);
  });

  it('atomically accepts only one concurrent submission', async () => {
    const proof = finalizeEvent(await createChallenge(user._id, npub), key);
    const results = await Promise.all([
      consumeProof(user._id, npub, proof),
      consumeProof(user._id, npub, proof),
    ]);
    results.sort().should.deepEqual([false, true]);
  });

  it('rejects malformed proof objects', async () => {
    const unsigned = await createChallenge(user._id, npub);
    for (const value of [
      undefined,
      null,
      {},
      { tags: [] },
      { ...unsigned, pubkey: getPublicKey(key), id: 'missing-signature' },
      {
        kind: 27235,
        created_at: 1,
        content: '',
        pubkey: getPublicKey(key),
        tags: [],
      },
    ]) {
      (await consumeProof(user._id, npub, value)).should.equal(false);
    }
  });

  it('rejects altered event fields and signatures without consuming a valid challenge', async () => {
    const event = await createChallenge(user._id, npub);
    const variants = [
      { kind: 1 },
      { content: 'changed' },
      { created_at: 0 },
      { created_at: Math.floor(Date.now() / 1000) + 60 },
      { created_at: 1.5 },
      { tags: [] },
      { tags: [['u', 'wrong'], ...event.tags.slice(1)] },
      { tags: [['u', event.tags[0][1], 'extra'], ...event.tags.slice(1)] },
      { tags: [event.tags[0], event.tags[0], event.tags[2]] },
      { tags: [event.tags[0], event.tags[1], ['challenge', '']] },
      { tags: [event.tags[0], event.tags[1], ['challenge', 'invalid']] },
      { tags: [event.tags[0], event.tags[1], ['other', 'value']] },
    ];
    for (const changes of variants) {
      const signed = finalizeEvent({ ...event, ...changes }, key);
      (await consumeProof(user._id, npub, signed)).should.equal(false);
    }
    const signed = finalizeEvent(event, key);
    (
      await consumeProof(user._id, npub, { ...signed, sig: '0'.repeat(128) })
    ).should.equal(false);
    (
      await consumeProof(user._id, npub, { ...signed, id: '0'.repeat(64) })
    ).should.equal(false);
    (await consumeProof(user._id, npub, signed)).should.equal(true);
  });

  it('rejects invalid or secret keys and missing members', async () => {
    for (const value of [undefined, 123, 'invalid', nip19.nsecEncode(key)]) {
      (() => decodeNpub(value)).should.throw();
    }
    await createChallenge(
      new mongoose.Types.ObjectId(),
      npub,
    ).should.be.rejected();
  });

  it('reports challenge access, input and database errors', async () => {
    const response = () => {
      const res = {
        code: 200,
        status(code: number) {
          this.code = code;
          return this;
        },
        json: sinon.spy(),
        sendStatus: sinon.spy(),
      };
      return res;
    };
    let res = response();
    await challenge({ body: {} } as never, res as never);
    res.sendStatus.calledWith(403).should.equal(true);
    res = response();
    await challenge(
      { user, body: { nostrNpub: 'invalid' } } as never,
      res as never,
    );
    res.code.should.equal(400);
    res = response();
    await challenge({ user, body: { nostrNpub: npub } } as never, res as never);
    res.code.should.equal(200);
    const stub = sinon
      .stub(User, 'updateOne')
      .rejects(new Error('unavailable'));
    res = response();
    await challenge({ user, body: { nostrNpub: npub } } as never, res as never);
    res.code.should.equal(503);
    stub.restore();
  });

  it('retains the profile when proof validation encounters a database failure', async () => {
    const proof = finalizeEvent(await createChallenge(user._id, npub), key);
    sinon.stub(User, 'updateOne').rejects(new Error('unavailable'));
    const res = await new Promise<{ code: number }>(resolve => {
      const response = {
        code: 200,
        status(code: number) {
          this.code = code;
          return this;
        },
        send() {
          resolve(this);
        },
      };
      profileController.update(
        { user, body: { nostrNpub: npub, nostrProof: proof } },
        response,
      );
    });
    res.code.should.equal(400);
    should.not.exist((await User.findById(user._id))!.nostrNpub);
  });
});
