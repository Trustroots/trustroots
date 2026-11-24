import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import 'should';
import { vi } from 'vitest';
import * as canonical from '../../../server/services/data-export-canonical.server.service.mts';
import * as signingService from '../../../server/services/data-export-signing.server.service.mts';
import * as verification from '../../../server/services/data-export-verification.server.service.mts';

const secretKey = generateSecretKey();
const publicKey = getPublicKey(secretKey);
const otherPublicKey = getPublicKey(generateSecretKey());

function signing() {
  vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', nip19.nsecEncode(secretKey));
  return signingService;
}

function buildFile(overrides = {}, now?: Date) {
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
      signature: signing().signPayload(payload, { username: 'member', now }),
      ...overrides,
    }),
  );
}

describe('Member data export verification', () => {
  after(() => {
    vi.unstubAllEnvs();
  });

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
    report.root!.status.should.equal('verified');
    report.event!.status.should.equal('verified');
    report.event!.claimedAt!.should.equal(
      new Date(report.event!.createdAt! * 1000).toISOString(),
    );
  });

  it('finds the attested root wherever the x tag sits among the tags', () => {
    const file = buildFile();
    file.signature.event = finalizeEvent(
      {
        kind: canonical.ATTESTATION_KIND,
        created_at: file.signature.event.created_at,
        tags: [
          ['m', 'application/json'],
          ['x', file.signature.root],
        ],
        content: '',
      },
      secretKey,
    );

    verification.verifyExport(file, { keyHistory }).valid.should.be.true();
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

  it('treats a signature that is not an object as no signature', () => {
    const report = verification.verifyExport(
      buildFile({ signature: 'signed' }),
    );

    report.signed.should.be.false();
    report.problems.should.deepEqual([
      'This export carries no signature, so nothing about its origin can be checked.',
    ]);
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

  it('rejects section digests that are not an object', () => {
    const file = buildFile();
    file.signature.sections = 'digests';

    verification
      .verifyExport(file, { keyHistory })
      .problems.should.deepEqual([
        'The signature carries no section digests, so there is nothing to check the data against.',
      ]);
  });

  it('fails the tampered section while verifying the unchanged root', () => {
    const file = buildFile();
    file.contacts[0].username = 'someone-else';

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.sections.contacts.status.should.equal('mismatch');
    report.sections.profile.status.should.equal('verified');
    report.root!.status.should.equal('verified');
    report.problems.should.deepEqual([
      'Section "contacts" does not match the signed digest; it has been altered.',
    ]);
  });

  it('fails the root when a section digest is swapped', () => {
    const file = buildFile();
    file.signature.sections.profile = 'a'.repeat(64);

    const report = verification.verifyExport(file, { keyHistory });

    report.sections.profile.status.should.equal('mismatch');
    report.root!.status.should.equal('mismatch');
    report.problems.should.containEql(
      'The root digest does not match the section digests it claims to cover.',
    );
  });

  it('fails the root when only the root digest is altered', () => {
    const file = buildFile();
    file.signature.root = 'c'.repeat(64);

    const report = verification.verifyExport(file, { keyHistory });

    report.sections.profile.status.should.equal('verified');
    report.root!.status.should.equal('mismatch');
    report.problems.should.containEql(
      'The root digest does not match the section digests it claims to cover.',
    );
  });

  it('verifies a profile-only export and reports which sections are absent', () => {
    const file = buildFile();
    for (const name of canonical.SECTION_NAMES) {
      if (name !== 'profile') delete file[name];
    }

    const report = verification.verifyExport(file, { keyHistory });

    report.sections.contacts.status.should.equal('absent');
    report.sections.profile.status.should.equal('verified');
    report.root!.status.should.equal('verified');
    report.partial.should.be.true();
    report.valid.should.be.true();
    report.problems.should.be.empty();
    verification
      .describeReport(report)
      .should.containEql('OK (partial export)');
  });

  it('rejects a partial export with a changed section or withheld digest', () => {
    const file = buildFile();
    delete file.contacts;
    file.profile.username = 'different-member';
    file.signature.sections.contacts = 'a'.repeat(64);

    const report = verification.verifyExport(file, { keyHistory });

    report.partial.should.be.true();
    report.valid.should.be.false();
    report.sections.profile.status.should.equal('mismatch');
    report.root!.status.should.equal('mismatch');
    verification.describeReport(report).should.containEql('FAILED');
  });

  it('rejects a file containing only the attestation', () => {
    const file = buildFile();
    for (const name of canonical.SECTION_NAMES) delete file[name];

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.problems.should.deepEqual([
      'The export contains no data sections to verify.',
    ]);
  });

  it('rejects a correctly signed event of a different kind', () => {
    const file = buildFile();
    file.signature.event = finalizeEvent(
      {
        kind: 1,
        created_at: file.signature.event.created_at,
        tags: file.signature.event.tags,
        content: '',
      },
      secretKey,
    );

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.event!.status.should.equal('invalid');
    report.problems.should.matchAny(/export attestation kind/);
  });

  it('fails when the event does not attest the signature root', () => {
    const file = buildFile();
    file.signature.event.tags = file.signature.event.tags.map((tag: string[]) =>
      tag[0] === 'x' ? ['x', 'b'.repeat(64)] : tag,
    );

    const report = verification.verifyExport(file, { keyHistory });

    report.event!.status.should.equal('mismatch');
    report.problems.should.deepEqual([
      'The Nostr event does not attest the root digest of this file.',
    ]);
  });

  it('fails when the event signature does not verify', () => {
    const file = buildFile();
    file.signature.event.content = 'tampered';

    const report = verification.verifyExport(file, { keyHistory });

    report.event!.status.should.equal('invalid');
    report.problems.should.deepEqual([
      'The Nostr event signature is not valid for its stated public key.',
    ]);
  });

  it('reports a signature that carries no Nostr event', () => {
    const file = buildFile();
    delete file.signature.event;

    const report = verification.verifyExport(file, { keyHistory });

    report.event!.status.should.equal('absent');
    report.problems.should.matchAny(/no Nostr event/);
  });

  it('reports an event that is not an object as absent', () => {
    const file = buildFile();
    file.signature.event = 'event';

    verification
      .verifyExport(file, { keyHistory })
      .event!.status.should.equal('absent');
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
      .event!.status.should.equal('invalid');
  });

  it('survives a hostile file whose event signature is not a string', () => {
    const file = buildFile();
    file.signature.event.sig = 12345;

    verification
      .verifyExport(file, { keyHistory })
      .event!.status.should.equal('invalid');
  });

  it('fails when the event carries no tags at all', () => {
    const file = buildFile();
    delete file.signature.event.tags;

    verification
      .verifyExport(file, { keyHistory })
      .event!.status.should.equal('mismatch');
  });

  it('reports a missing event timestamp instead of throwing', () => {
    const file = buildFile();
    delete file.signature.event.created_at;

    const report = verification.verifyExport(file, { keyHistory });

    report.event!.status.should.equal('invalid');
    report.problems.should.containEql(
      'The Nostr event has no valid timestamp or tag list, so it cannot be checked.',
    );
    verification.describeReport(report).should.containEql('FAILED');
  });

  it('reports an out-of-range event timestamp instead of throwing', () => {
    const file = buildFile();
    file.signature.event.created_at = 1e20;

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.event!.status.should.equal('invalid');
  });

  it('reports a non-array tag container instead of throwing', () => {
    const file = buildFile();
    file.signature.event.tags = {};

    const report = verification.verifyExport(file, { keyHistory });

    report.valid.should.be.false();
    report.event!.status.should.equal('invalid');
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

    report.key!.status.should.equal('unknown');
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

    report.key!.status.should.equal('retired');
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

  it('rejects a signature dated before the key became valid', () => {
    const report = verification.verifyExport(buildFile(), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'active',
          validFrom: '2100-01-01T00:00:00.000Z',
        },
      ],
    });

    report.problems.should.matchAny(/validity window/);
  });

  it('accepts a signature dated exactly at both ends of the validity window', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const report = verification.verifyExport(buildFile({}, now), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'retired',
          validFrom: now.toISOString(),
          validUntil: now.toISOString(),
        },
      ],
    });

    report.valid.should.be.true();
  });

  it('rejects a compromised-key signature dated exactly at the revocation', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const report = verification.verifyExport(buildFile({}, now), {
      keyHistory: [
        {
          pubkey: publicKey,
          status: 'compromised',
          revokedAt: now.toISOString(),
        },
      ],
    });

    report.problems.should.matchAny(/after the key was revoked/);
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

    report.key!.status.should.equal('compromised');
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
    verification.verifyExport(buildFile()).key!.status.should.equal('unknown');
  });

  describe('describeReport', () => {
    it('renders a human-readable report of a good export', () => {
      const now = new Date('2026-09-05T12:00:00.000Z');
      verification
        .describeReport(
          verification.verifyExport(buildFile({}, now), { keyHistory }),
        )
        .should.equal(
          [
            'Format:      trustroots-data-export version 2',
            'Exported at: 2026-09-05T12:00:00.000Z (not signed)',
            ...canonical.SECTION_NAMES.map(name => `Section ${name}: verified`),
            'Root digest: verified',
            'Attestation: verified',
            `Signed by:   ${publicKey}`,
            'Claimed at:  2026-09-05T12:00:00.000Z (signer-chosen, unproven)',
            'Key status:  active',
            'Result:      OK',
          ].join('\n'),
        );
    });

    it('renders a report for a file that is not an export at all', () => {
      verification
        .describeReport(verification.verifyExport(null))
        .should.equal(
          [
            'Format:      undefined version undefined',
            'Exported at: not stated (not signed)',
            ...canonical.SECTION_NAMES.map(
              name => `Section ${name}: not checked`,
            ),
            'Root digest: not checked',
            'Problem:     The export is not a JSON object.',
            'Result:      FAILED',
          ].join('\n'),
        );
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
