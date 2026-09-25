const proxyquire = require('proxyquire').noCallThru();
const { generateSecretKey, getPublicKey } = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');
const sinon = require('sinon');
require('should');

const canonical = require('../../../server/services/data-export-canonical.server.service');
const verification = require('../../../server/services/data-export-verification.server.service');

const signingPath =
  '../../../server/services/data-export-signing.server.service';

const secretKey = generateSecretKey();
const publicKey = getPublicKey(secretKey);
const otherPublicKey = getPublicKey(generateSecretKey());

function signing() {
  return proxyquire(signingPath, {
    '../../../../config/lib/logger': sinon.stub(),
    '../../../../config/config': {
      dataExportSigning: { nsec: nip19.nsecEncode(secretKey) },
    },
  });
}

function buildFile(overrides = {}) {
  const payload = canonical.buildSignedPayload({
    profile: { username: 'member', displayName: 'Member Example' },
    contacts: [{ _id: 'contact-1', username: 'other-member' }],
    hostingOffers: [{ _id: 'offer-1', status: 'yes' }],
  });

  // Round-tripped through JSON, because that is what a verifier is handed: a
  // downloaded file, not the in-memory objects the server signed.
  return JSON.parse(
    JSON.stringify({
      ...payload,
      exportedAt: '2026-09-05T12:00:00.000Z',
      signature: signing().signPayload(payload, { username: 'member' }),
      ...overrides,
    }),
  );
}

describe('Member data export verification', () => {
  const keyHistory = [
    {
      pubkey: publicKey,
      status: 'active',
      validFrom: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('accepts an untouched signed export', () => {
    const report = verification.verifyExport(buildFile(), { keyHistory });

    report.valid.should.be.true();
    report.problems.should.be.empty();
    report.signed.should.be.true();
    report.sections.profile.status.should.equal('verified');
    report.root.status.should.equal('verified');
    report.event.status.should.equal('verified');
  });

  it('rejects a file that is not a JSON object', () => {
    verification.verifyExport(null).valid.should.be.false();
    verification
      .verifyExport('nope')
      .problems.should.matchAny(/not a JSON object/);
  });

  it('rejects an unrecognised format or version', () => {
    verification
      .verifyExport(buildFile({ format: 'something-else' }))
      .problems.should.matchAny(/format/);
    verification
      .verifyExport(buildFile({ version: 99 }))
      .problems.should.matchAny(/version/);
  });

  it('reports an unsigned export without claiming it is valid', () => {
    const report = verification.verifyExport(buildFile({ signature: null }));

    report.signed.should.be.false();
    report.valid.should.be.false();
    report.problems.should.matchAny(/no signature/);
  });

  it('rejects an unknown signature algorithm', () => {
    const file = buildFile();
    file.signature.alg = 'pgp';

    verification
      .verifyExport(file, { keyHistory })
      .problems.should.matchAny(/algorithm/);
  });

  it('rejects a signature with no section digests', () => {
    const file = buildFile();
    delete file.signature.sections;

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.problems.should.matchAny(/no section digests/);
  });

  it('fails the tampered section and the root when a byte changes', () => {
    const file = buildFile();
    file.contacts[0].username = 'someone-else';

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.sections.contacts.status.should.equal('mismatch');
    report.sections.profile.status.should.equal('verified');
    report.root.status.should.equal('mismatch');
  });

  it('fails the root when a section digest is swapped', () => {
    const file = buildFile();
    file.signature.sections.profile = 'a'.repeat(64);

    const report = verification.verifyExport(file, { keyHistory });

    report.sections.profile.status.should.equal('mismatch');
    report.root.status.should.equal('mismatch');
  });

  it('distinguishes an absent section from an empty one', () => {
    const file = buildFile();
    delete file.contacts;

    const report = verification.verifyExport(file, { keyHistory });

    report.sections.contacts.status.should.equal('absent');
    report.valid.should.be.false();
    report.problems.should.matchAny(/withheld/);
  });

  it('fails when the event does not attest the signature root', () => {
    const file = buildFile();
    file.signature.event.tags = file.signature.event.tags.map(tag =>
      tag[0] === 'x' ? ['x', 'b'.repeat(64)] : tag,
    );

    verification
      .verifyExport(file, { keyHistory })
      .event.status.should.equal('mismatch');
  });

  it('fails when the event signature does not verify', () => {
    const file = buildFile();
    file.signature.event.content = 'tampered';

    const report = verification.verifyExport(file, { keyHistory });

    report.event.status.should.equal('invalid');
    report.valid.should.be.false();
  });

  it('reports a signature that carries no Nostr event', () => {
    const file = buildFile();
    delete file.signature.event;

    const report = verification.verifyExport(file, { keyHistory });

    report.event.status.should.equal('absent');
    report.problems.should.matchAny(/no Nostr event/);
  });

  it('accepts a key history entry with no validity window', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [{ pubkey: publicKey, status: 'active' }],
    });

    report.valid.should.be.true();
  });

  it('survives a hostile file whose event tags contain holes', () => {
    const file = buildFile();
    file.signature.event.tags = [null, ...file.signature.event.tags];

    verification
      .verifyExport(file, { keyHistory })
      .event.status.should.equal('invalid');
  });

  it('fails when the event carries no tags at all', () => {
    const file = buildFile();
    delete file.signature.event.tags;

    verification
      .verifyExport(file, { keyHistory })
      .event.status.should.equal('mismatch');
  });

  it('rejects a compromised key with no recorded revocation date', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [{ pubkey: publicKey, status: 'compromised' }],
    });

    report.valid.should.be.false();
    report.problems.should.matchAny(/after the key was revoked/);
  });

  it('reports a key that is absent from the pinned history', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [{ pubkey: otherPublicKey, status: 'active' }],
    });

    report.key.status.should.equal('unknown');
    report.valid.should.be.false();
    report.problems.should.matchAny(/pinned key history/);
  });

  it('accepts a signature from a retired key made inside its validity window', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'retired',
          validFrom: '2026-01-01T00:00:00.000Z',
          validUntil: '2030-01-01T00:00:00.000Z',
        },
      ],
    });

    report.key.status.should.equal('retired');
    report.valid.should.be.true();
  });

  it('rejects a signature dated outside the key validity window', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'retired',
          validFrom: '2000-01-01T00:00:00.000Z',
          validUntil: '2001-01-01T00:00:00.000Z',
        },
      ],
    });

    report.valid.should.be.false();
    report.problems.should.matchAny(/validity window/);
  });

  it('reports a compromised key and says the claimed date is unproven', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'compromised',
          validFrom: '2026-01-01T00:00:00.000Z',
          revokedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    });

    report.key.status.should.equal('compromised');
    report.valid.should.be.false();
    report.problems.should.matchAny(/cannot be proven/);
  });

  it('rejects a compromised-key signature dated after the revocation', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'compromised',
          validFrom: '2026-01-01T00:00:00.000Z',
          revokedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });

    report.valid.should.be.false();
    report.problems.should.matchAny(/after the key was revoked/);
  });

  it('reports an unknown key when no pinned history is supplied', () => {
    verification.verifyExport(buildFile()).key.status.should.equal('unknown');
  });

  describe('describeReport', () => {
    it('renders a human-readable report of a good export', () => {
      const text = verification.describeReport(
        verification.verifyExport(buildFile(), { keyHistory }),
      );

      text.should.match(/profile/);
      text.should.match(/verified/);
      text.should.match(/OK/);
    });

    it('renders a report for a file that is not an export at all', () => {
      const text = verification.describeReport(verification.verifyExport(null));

      text.should.match(/not stated/);
      text.should.match(/FAILED/);
    });

    it('renders the problems of a bad export', () => {
      const text = verification.describeReport(
        verification.verifyExport(buildFile({ signature: null })),
      );

      text.should.match(/FAILED/);
      text.should.match(/no signature/);
    });
  });
});
