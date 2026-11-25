import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import 'should';
import { vi } from 'vitest';
import * as canonical from '../../../server/services/data-export-canonical.server.service.mts';
import * as service from '../../../server/services/data-export-signing.server.service.mts';

function loadService(nsec: string) {
  vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', nsec);
  return service;
}

describe('Member data export signing', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const secretKey = generateSecretKey();
  const nsec = nip19.nsecEncode(secretKey);
  const publicKey = getPublicKey(secretKey);
  const payload = canonical.buildSignedPayload({
    profile: { username: 'member' },
    contacts: [{ _id: 'contact-1' }],
    hostingOffers: [],
  });
  const sign = (options?: Parameters<typeof service.signPayload>[1]) =>
    loadService(nsec).signPayload(payload, options)!;
  const tagsOf = (event: { tags: string[][] }) =>
    new Map(event.tags as [string, string][]);

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

  it('returns no signature when the decoded key is not a usable secp256k1 secret', () => {
    (
      loadService(nip19.nsecEncode(new Uint8Array(32))).signPayload(payload, {
        username: 'member',
      }) === null
    ).should.be.true();
  });

  it('signs the payload digests with a valid Nostr event', () => {
    const signature = sign({ username: 'member' });

    signature.alg.should.equal(canonical.SIGNATURE_ALGORITHM);
    signature.signed.should.deepEqual([
      'format',
      'version',
      'profile',
      'contacts',
      'hostingOffers',
      'circles',
      'messages',
      'experiences',
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
    const { event, root } = sign({ username: 'member' });
    const tags = tagsOf(event);

    tags.get('x')!.should.equal(root);
    tags.get('m')!.should.equal('application/json');
    tags.get('d')!.should.equal('member');
    tags.get('alt')!.should.equal('Trustroots member data export attestation');
    event.content.should.equal('');
  });

  it('uses the same service key precedence as NIP-05', () => {
    const legacy = generateSecretKey();
    vi.stubEnv('TRUSTROOTS_NOSTR_EXPORT_NSEC', nip19.nsecEncode(legacy));
    sign().event.pubkey.should.equal(publicKey);
    vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', undefined);
    service
      .signPayload(payload)!
      .event.pubkey.should.equal(getPublicKey(legacy));
    vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', 'invalid');
    (service.signPayload(payload) === null).should.be.true();
  });

  it('attests the same root for repeated exports of unchanged data', () => {
    sign({ username: 'member' }).root.should.equal(
      sign({ username: 'member' }).root,
    );
  });

  it('signs without options, leaving the member tag empty', () => {
    const { event } = sign();
    const tags = tagsOf(event);

    tags.get('d')!.should.equal('');
  });

  it('stamps the signing time in seconds', () => {
    const { event } = sign({
      username: 'member',
      now: new Date('2026-09-05T12:00:00.000Z'),
    });

    event.created_at.should.equal(1788609600);
  });
});
