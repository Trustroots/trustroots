import { readFile, writeFile } from 'node:fs/promises';
import {
  selectPreview,
  releasesApi,
  zapstoreRelease,
} from '../../docs/assets/js/android-release-metadata.mjs';

const file = new URL('../../docs/_data/android_releases.json', import.meta.url);
const snapshot = JSON.parse(await readFile(file, 'utf8'));
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
    snapshot.download = selectPreview(await response.json());
  })().catch(error =>
    console.warn('Keeping verified download snapshot:', error.message),
  ),
  zapstoreRelease()
    .then(release => {
      snapshot.zapstore = release;
    })
    .catch(error =>
      console.warn('Keeping verified Zapstore snapshot:', error.message),
    ),
]);
await writeFile(file, JSON.stringify(snapshot, null, 2) + '\n');
