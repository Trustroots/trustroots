import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { describeApk } from '../android/release-descriptor.mts';
import { prepareCandidate } from './android-release-metadata.mts';
import {
  certificate,
  digest,
  validateCandidate,
  publishPreview,
} from '../../docs/src/zapstore-publisher.mts';

const bytes = new TextEncoder().encode('Fictional Android APK bytes');
const badging =
  "package: name='org.trustroots.android' versionCode='100050' versionName='0.1-20261022-1200'\nsdkVersion:'26'\ntargetSdkVersion:'37'";
const signing = `V2 Signer: certificate SHA-256 digest: ${certificate}`;
const candidate = describeApk(bytes, badging, signing, '2026-10-22T12:00:00Z');

test('descriptor contains the APK identity, bytes and established signing certificate', async () => {
  assert.equal(candidate.sha256, await digest(bytes));
  assert.equal(candidate.size, bytes.length);
  assert.equal(candidate.minSdk, 26);
  assert.equal(candidate.targetSdk, 37);
  assert.equal(candidate.versionCode, 100050);
  assert.equal(candidate.platforms.length, 4);
  assert.deepEqual(
    describeApk(
      bytes,
      badging,
      `Signer #1 certificate SHA-256 digest: ${certificate}`,
      candidate.published,
    ),
    candidate,
  );
  assert.equal(
    describeApk(
      bytes,
      badging + "\nnative-code: 'arm64-v8a'",
      signing,
      candidate.published,
    ).platforms.length,
    1,
  );
});

for (const [label, change] of [
  ['other package', { appId: 'example.app' }],
  ['other certificate', { certificate: '0'.repeat(64) }],
  ['unsafe filename', { filename: '../app.apk' }],
  ['other download URL', { url: 'https://example.com/app.apk' }],
  ['invalid digest', { sha256: 'bad' }],
  ['invalid size', { size: 0 }],
  ['invalid version code', { versionCode: 1 }],
  ['missing arm64 support', { platforms: ['android-x86'] }],
  ['invalid SDK', { targetSdk: 1 }],
] as const) {
  test(`candidate validation rejects ${label}`, () =>
    assert.throws(() => validateCandidate({ ...candidate, ...change })));
}

test('descriptor rejects unverified certificates, multiple signers and missing APK fields', () => {
  assert.throws(() =>
    describeApk(
      bytes,
      badging,
      signing.replace(certificate, '0'.repeat(64)),
      candidate.published,
    ),
  );
  assert.throws(() =>
    describeApk(
      bytes,
      badging,
      signing + '\nSigner #2 certificate SHA-256 digest: ' + '0'.repeat(64),
      candidate.published,
    ),
  );
  assert.throws(() => describeApk(bytes, '', signing, candidate.published));
});

test('docs preparation writes only APK bytes matching the verified descriptor', async () => {
  const path = await mkdtemp(join(tmpdir(), 'docs-apk-'));
  const docs = pathToFileURL(path + '/');
  await mkdir(new URL('_data/', docs));
  try {
    await prepareCandidate(candidate, docs, async () => new Response(bytes));
    assert.deepEqual(
      new Uint8Array(
        await readFile(
          new URL(`assets/downloads/${candidate.sha256}.apk`, docs),
        ),
      ),
      bytes,
    );
    assert.equal(
      JSON.parse(
        await readFile(new URL('_data/zapstore_candidate.json', docs), 'utf8'),
      ).version,
      candidate.version,
    );
    await assert.rejects(
      prepareCandidate(
        candidate,
        docs,
        async () => new Response('different bytes'),
      ),
      /digest mismatch/,
    );
    await assert.rejects(
      prepareCandidate(
        candidate,
        docs,
        async () => new Response(null, { status: 404 }),
      ),
      /download failed/,
    );
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});

test('publishing cannot start without a NIP-07 signer or with a different identity', async () => {
  await assert.rejects(publishPreview(candidate), /NIP-07/);
  await assert.rejects(
    publishPreview(candidate, {
      signer: {
        getPublicKey: async () => '0'.repeat(64),
        signEvent: async () => {
          throw new Error('Not reached');
        },
      },
    }),
    /Trustroots publisher identity/,
  );
});
