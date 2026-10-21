import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  selectPreview,
  releasesApi,
  zapstoreRelease,
} from '../../docs/src/android-release-metadata.mts';
import { validateCandidate } from '../../docs/src/zapstore-publisher.mts';

export async function prepareCandidate(
  descriptor: unknown,
  docs: URL,
  fetcher: typeof fetch = fetch,
) {
  const candidate = validateCandidate(descriptor);
  const response = await fetcher(candidate.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error('Candidate APK download failed');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    bytes.byteLength !== candidate.size ||
    createHash('sha256').update(bytes).digest('hex') !== candidate.sha256
  ) {
    throw new Error('Candidate APK digest mismatch');
  }
  const directory = new URL('assets/downloads/', docs);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`${candidate.sha256}.apk`, directory), bytes);
  await writeFile(
    new URL('_data/zapstore_candidate.json', docs),
    JSON.stringify(candidate, null, 2) + '\n',
  );
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  digest: string;
  size: number;
}
interface GitHubRelease {
  published_at: string;
  assets: GitHubAsset[];
}

async function main() {
  const docs = new URL('../../docs/', import.meta.url);
  const file = new URL('_data/android_releases.json', docs);
  const candidateFile = new URL('_data/zapstore_candidate.json', docs);
  const snapshot = JSON.parse(await readFile(file, 'utf8'));
  let candidate = JSON.parse(await readFile(candidateFile, 'utf8'));
  await Promise.all([
    (async () => {
      const response = await fetch(releasesApi, {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error(`GitHub release lookup: HTTP ${response.status}`);
      const releases: GitHubRelease[] = await response.json();
      snapshot.download = selectPreview(releases);
      const release = releases.find(item =>
        item.assets.some(
          asset => asset.browser_download_url === snapshot.download.url,
        ),
      );
      const descriptor = release?.assets.find(
        asset =>
          asset.name === `trustroots-android-${snapshot.download.version}.json`,
      );
      if (descriptor && release) {
        const metadata = await fetch(descriptor.browser_download_url, {
          signal: AbortSignal.timeout(15000),
        });
        if (!metadata.ok)
          throw new Error('Candidate descriptor download failed');
        const prepared = validateCandidate(await metadata.json());
        const apk = release?.assets.find(
          asset => asset.browser_download_url === prepared.url,
        );
        if (
          !apk ||
          prepared.version !== snapshot.download.version ||
          apk.digest !== `sha256:${prepared.sha256}` ||
          apk.size !== prepared.size
        ) {
          throw new Error('Candidate descriptor does not match the GitHub APK');
        }
        candidate = { ...prepared, published: release.published_at };
      }
    })().catch(error =>
      console.warn(
        'Keeping verified release metadata where lookup failed:',
        error.message,
      ),
    ),
    zapstoreRelease()
      .then(release => {
        snapshot.zapstore = release;
      })
      .catch(error =>
        console.warn('Keeping verified Zapstore snapshot:', error.message),
      ),
  ]);
  try {
    await prepareCandidate(candidate, docs);
  } catch (error) {
    console.warn(
      'Browser publishing is unavailable for this deployment:',
      (error as Error).message,
    );
    await rm(candidateFile, { force: true });
  }
  await writeFile(file, JSON.stringify(snapshot, null, 2) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
