const proxyquire = require('proxyquire').noCallThru();
const {
  generateSecretKey,
  getPublicKey,
  verifyEvent,
} = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');
const sinon = require('sinon');
require('should');

const canonical = require('../../../server/services/data-export-canonical.server.service');

const servicePath =
  '../../../server/services/data-export-signing.server.service';

function loadService(nsec) {
  return proxyquire(servicePath, {
    '../../../../config/lib/logger': sinon.stub(),
    '../../../../config/config': { dataExportSigning: { nsec } },
  });
}

describe('Member data export signing', () => {
  const secretKey = generateSecretKey();
  const nsec = nip19.nsecEncode(secretKey);
  const publicKey = getPublicKey(secretKey);
  const payload = canonical.buildSignedPayload({
    profile: { username: 'member' },
    contacts: [{ _id: 'contact-1' }],
    hostingOffers: [],
  });

  it('returns no signature when no signing key is configured', () => {
    (
      loadService('').signPayload(payload, { username: 'member' }) === null
    ).should.be.true();
  });

  it('returns no signature when the configured key cannot be decoded', () => {
    (
      loadService('not-an-nsec').signPayload(payload, {
        username: 'member',
      }) === null
    ).should.be.true();
  });

  it('returns no signature when the configured key is not an nsec', () => {
    const npub = nip19.npubEncode(publicKey);

    (
      loadService(npub).signPayload(payload, { username: 'member' }) === null
    ).should.be.true();
  });

  it('signs the payload digests with a valid Nostr event', () => {
    const signature = loadService(nsec).signPayload(payload, {
      username: 'member',
    });

    signature.alg.should.equal(canonical.SIGNATURE_ALGORITHM);
    signature.signed.should.deepEqual([
      'format',
      'version',
      'profile',
      'contacts',
      'hostingOffers',
    ]);
    signature.sections.should.deepEqual(
      canonical.digestPayload(payload).sections,
    );
    signature.root.should.equal(canonical.digestPayload(payload).root);
    signature.event.pubkey.should.equal(publicKey);
    signature.event.kind.should.equal(30410);
    verifyEvent(signature.event).should.be.true();
  });

  it('tags the event with the root digest, media type, and member', () => {
    const { event, root } = loadService(nsec).signPayload(payload, {
      username: 'member',
    });
    const tags = new Map(event.tags.map(([name, value]) => [name, value]));

    tags.get('x').should.equal(root);
    tags.get('m').should.equal('application/json');
    tags.get('d').should.equal('member');
    tags.get('alt').should.equal('Trustroots member data export attestation');
  });

  it('attests the same root for repeated exports of unchanged data', () => {
    const service = loadService(nsec);

    service
      .signPayload(payload, { username: 'member' })
      .root.should.equal(
        service.signPayload(payload, { username: 'member' }).root,
      );
  });

  it('signs without options, leaving the member tag empty', () => {
    const { event } = loadService(nsec).signPayload(payload);
    const tags = new Map(event.tags.map(([name, value]) => [name, value]));

    tags.get('d').should.equal('');
  });

  it('stamps the signing time in seconds', () => {
    const { event } = loadService(nsec).signPayload(payload, {
      username: 'member',
      now: new Date('2026-09-05T12:00:00.000Z'),
    });

    event.created_at.should.equal(1788609600);
  });
});
