import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  certificate,
  validateCandidate,
} from '../../docs/src/zapstore-publisher.mts';

export function describeApk(
  bytes: Uint8Array,
  badging: string,
  signing: string,
  published: string,
) {
  const match = (pattern: RegExp) => {
    const value = badging.match(pattern)?.[1];
    if (!value) throw new Error('APK metadata is incomplete');
    return value;
  };
  const version = match(/versionName='([^']+)'/);
  const versionCode = Number(match(/versionCode='(\d+)'/));
  const filename = `trustroots-android-${version}.apk`;
  const fingerprints = [
    ...new Set(
      [
        ...signing.matchAll(
          /(?:Signer #\d+|V\d+ Signer):? certificate SHA-256 digest: ([0-9a-f]+)/g,
        ),
      ].map(match => match[1]),
    ),
  ];
  if (fingerprints.length !== 1 || fingerprints[0] !== certificate)
    throw new Error('Unexpected APK signing certificate');
  return validateCandidate({
    appId: match(/package: name='([^']+)'/),
    version,
    versionCode,
    filename,
    url: `https://github.com/Trustroots/trustroots/releases/download/android-preview-${versionCode}-v${version}/${filename}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength,
    certificate,
    minSdk: Number(match(/sdkVersion:'(\d+)'/)),
    targetSdk: Number(match(/targetSdkVersion:'(\d+)'/)),
    platforms: badging
      .match(/native-code: (.+)/)?.[1]
      .match(/'([^']+)'/g)
      ?.map(value => `android-${value.slice(1, -1)}`) || [
      'android-arm64-v8a',
      'android-armeabi-v7a',
      'android-x86',
      'android-x86_64',
    ],
    published,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [apk, destination] = process.argv.slice(2);
  if (!apk || !destination || !process.env.ANDROID_HOME)
    throw new Error(
      'Usage: release-descriptor.mts APK DESTINATION (requires ANDROID_HOME)',
    );
  const tools = `${process.env.ANDROID_HOME}/build-tools/37.0.0`;
  const badging = execFileSync(`${tools}/aapt`, ['dump', 'badging', apk], {
    encoding: 'utf8',
  });
  const signing = execFileSync(
    `${tools}/apksigner`,
    ['verify', '--print-certs', apk],
    { encoding: 'utf8' },
  );
  const descriptor = describeApk(
    readFileSync(apk),
    badging,
    signing,
    new Date().toISOString(),
  );
  writeFileSync(destination, JSON.stringify(descriptor, null, 2) + '\n');
}
