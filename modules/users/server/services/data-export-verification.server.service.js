/**
 * Standalone verification of a signed member data export.
 *
 * This deliberately reports rather than merely passing or failing: a fork
 * operator deciding whether to trust an imported social graph needs to know
 * *which* section failed, which key signed it, and what that key's status is.
 *
 * What this can and cannot establish is worth stating plainly. It establishes
 * that the holder of a particular Nostr key attested these exact bytes. It
 * does *not* establish when that happened: NIP-01 `created_at` is chosen by
 * whoever holds the key, so a thief can backdate. Anchoring the signing time
 * to an independent source (OpenTimestamps) is deliberately left as a
 * follow-up; the sectioned root digest is the hook it will hang from.
 */

const { verifyEvent } = require('nostr-tools/pure');

const canonical = require('./data-export-canonical.server.service');

function findTag(event, name) {
  const tag = (event.tags || []).find(entry => entry && entry[0] === name);
  return tag ? tag[1] : undefined;
}

function verifySections(file, signature, report) {
  canonical.SECTION_NAMES.forEach(name => {
    const expected = signature.sections[name];

    if (file[name] === undefined) {
      report.sections[name] = { status: 'absent', expected };
      report.problems.push(
        `Section "${name}" is withheld from this file; the attestation covers it, so this file is a partial export.`,
      );
      return;
    }

    const actual = canonical.sha256Hex(canonical.canonicalise(file[name]));

    if (actual === expected) {
      report.sections[name] = { status: 'verified', expected, actual };
      return;
    }

    report.sections[name] = { status: 'mismatch', expected, actual };
    report.problems.push(
      `Section "${name}" does not match the signed digest; it has been altered.`,
    );
  });
}

function verifyRoot(file, signature, report) {
  const recomputed = canonical.sha256Hex(
    canonical.canonicalise({
      format: file.format,
      version: file.version,
      sections: signature.sections,
    }),
  );

  const sectionsIntact = canonical.SECTION_NAMES.every(
    name => report.sections[name].status === 'verified',
  );

  if (recomputed === signature.root && sectionsIntact) {
    report.root = { status: 'verified', expected: signature.root };
    return;
  }

  report.root = {
    status: 'mismatch',
    expected: signature.root,
    actual: recomputed,
  };

  if (recomputed !== signature.root) {
    report.problems.push(
      'The root digest does not match the section digests it claims to cover.',
    );
  }
}

function verifyAttestation(signature, report) {
  const event = signature.event;

  if (!event || typeof event !== 'object') {
    report.event = { status: 'absent' };
    report.problems.push('The signature carries no Nostr event.');
    return;
  }

  report.event = {
    status: 'verified',
    pubkey: event.pubkey,
    kind: event.kind,
    createdAt: event.created_at,
    claimedAt: new Date(event.created_at * 1000).toISOString(),
  };

  if (findTag(event, 'x') !== signature.root) {
    report.event.status = 'mismatch';
    report.problems.push(
      'The Nostr event does not attest the root digest of this file.',
    );
    return;
  }

  // A downloaded file is hostile input: `verifyEvent` throws on a malformed
  // event rather than returning false, and a verifier that crashes on a bad
  // file is a verifier nobody runs.
  let verified = false;

  try {
    verified = verifyEvent(event);
  } catch (error) {
    verified = false;
  }

  if (!verified) {
    report.event.status = 'invalid';
    report.problems.push(
      'The Nostr event signature is not valid for its stated public key.',
    );
  }
}

function verifyKey(report, keyHistory) {
  const pubkey = report.event && report.event.pubkey;
  const entry = (keyHistory || []).find(
    candidate => candidate.pubkey === pubkey,
  );

  if (!entry) {
    report.key = { status: 'unknown', pubkey };
    report.problems.push(
      'The signing key is not in the pinned key history, so its provenance is unknown.',
    );
    return;
  }

  const signedAt = report.event.createdAt * 1000;
  report.key = { status: entry.status, pubkey, entry };

  const from = entry.validFrom ? Date.parse(entry.validFrom) : -Infinity;
  const until = entry.validUntil ? Date.parse(entry.validUntil) : Infinity;

  if (signedAt < from || signedAt > until) {
    report.problems.push(
      'The signature claims a date outside the key validity window.',
    );
  }

  if (entry.status !== 'compromised') {
    return;
  }

  const revokedAt = entry.revokedAt ? Date.parse(entry.revokedAt) : -Infinity;

  if (signedAt >= revokedAt) {
    report.problems.push(
      'The signature claims a date after the key was revoked as compromised.',
    );
    return;
  }

  report.problems.push(
    'The signing key was reported compromised. The signature claims a date before the compromise, but that claim cannot be proven without an independent time anchor.',
  );
}

/**
 * @returns {object} a report; `valid` is true only when every check passed.
 */
function verifyExport(file, { keyHistory } = {}) {
  const report = {
    valid: false,
    signed: false,
    problems: [],
    sections: {},
    root: null,
    event: null,
    key: null,
  };

  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    report.problems.push('The export is not a JSON object.');
    return report;
  }

  report.format = file.format;
  report.version = file.version;
  report.exportedAt = file.exportedAt;

  if (file.format !== canonical.EXPORT_FORMAT) {
    report.problems.push(
      `Unexpected export format "${file.format}"; expected "${canonical.EXPORT_FORMAT}".`,
    );
    return report;
  }

  if (file.version !== canonical.EXPORT_VERSION) {
    report.problems.push(
      `Unsupported export version "${file.version}"; this verifier understands version ${canonical.EXPORT_VERSION}.`,
    );
    return report;
  }

  const signature = file.signature;

  if (!signature || typeof signature !== 'object') {
    report.problems.push(
      'This export carries no signature, so nothing about its origin can be checked.',
    );
    return report;
  }

  report.signed = true;

  if (signature.alg !== canonical.SIGNATURE_ALGORITHM) {
    report.problems.push(
      `Unsupported signature algorithm "${signature.alg}"; expected "${canonical.SIGNATURE_ALGORITHM}".`,
    );
    return report;
  }

  if (!signature.sections || typeof signature.sections !== 'object') {
    report.problems.push(
      'The signature carries no section digests, so there is nothing to check the data against.',
    );
    return report;
  }

  verifySections(file, signature, report);
  verifyRoot(file, signature, report);
  verifyAttestation(signature, report);
  verifyKey(report, keyHistory);

  report.valid = report.problems.length === 0;

  return report;
}

function describeReport(report) {
  const lines = [];

  lines.push(`Format:      ${report.format} version ${report.version}`);
  lines.push(`Exported at: ${report.exportedAt || 'not stated'} (not signed)`);

  canonical.SECTION_NAMES.forEach(name => {
    const section = report.sections[name];
    lines.push(`Section ${name}: ${section ? section.status : 'not checked'}`);
  });

  lines.push(
    `Root digest: ${report.root ? report.root.status : 'not checked'}`,
  );

  if (report.event) {
    lines.push(`Attestation: ${report.event.status}`);
    lines.push(`Signed by:   ${report.event.pubkey}`);
    lines.push(
      `Claimed at:  ${report.event.claimedAt} (signer-chosen, unproven)`,
    );
  }

  if (report.key) {
    lines.push(`Key status:  ${report.key.status}`);
  }

  report.problems.forEach(problem => lines.push(`Problem:     ${problem}`));

  lines.push(report.valid ? 'Result:      OK' : 'Result:      FAILED');

  return lines.join('\n');
}

module.exports = { describeReport, verifyExport };
