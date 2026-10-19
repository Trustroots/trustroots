import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';

const source = readFileSync(
  new URL('../../docs/assets/js/latest-apk.js', import.meta.url),
  'utf8',
);
const releasesUrl = 'https://github.com/Trustroots/trustroots/releases';
const apkUrl = `${releasesUrl}/download/android-preview-100001/trustroots-android-preview.apk`;

function release(published = '2026-10-19T09:15:30Z') {
  return {
    draft: false,
    prerelease: true,
    tag_name: 'android-preview-100001',
    published_at: published,
    assets: [
      { name: 'trustroots-android-preview.apk.sha256' },
      { name: 'trustroots-android-preview.apk', browser_download_url: apkUrl },
    ],
  };
}

async function load(
  page: 'apps' | 'download',
  releases: unknown = [release()],
  failure?: 'http' | 'network',
) {
  const elements = new Map<
    string,
    { href: string; hidden: boolean; textContent: string; dateTime: string }
  >();
  const ids =
    page === 'apps'
      ? [
          'android-preview-link',
          'android-preview-updated',
          'android-preview-time',
        ]
      : ['latest-apk-link', 'latest-apk-status'];
  for (const id of ids) {
    elements.set(id, {
      href: page === 'apps' ? '/apps/latest-apk/' : releasesUrl,
      hidden: true,
      textContent: '',
      dateTime: '',
    });
  }
  let redirected: string | undefined;
  runInNewContext(source, {
    document: { getElementById: (id: string) => elements.get(id) ?? null },
    window: { location: { replace: (url: string) => (redirected = url) } },
    fetch: async () => {
      if (failure === 'network') throw new Error('Network unavailable');
      return { ok: failure !== 'http', json: async () => releases };
    },
  });
  await setImmediate();
  return { elements, redirected };
}

test('apps page shows the newest published preview date in UTC and its APK link', async () => {
  const newest = release();
  const { elements, redirected } = await load('apps', [
    release('2026-10-01T12:00:00Z'),
    { ...newest, draft: true, published_at: '2026-10-20T12:00:00Z' },
    { ...newest, prerelease: false, published_at: '2026-10-21T12:00:00Z' },
    {
      ...newest,
      tag_name: 'ios-preview-1',
      published_at: '2026-10-22T12:00:00Z',
    },
    { ...newest, assets: [], published_at: '2026-10-23T12:00:00Z' },
    newest,
  ]);
  assert.equal(elements.get('android-preview-link')?.href, apkUrl);
  assert.equal(elements.get('android-preview-updated')?.hidden, false);
  assert.equal(
    elements.get('android-preview-time')?.dateTime,
    '2026-10-19T09:15:30.000Z',
  );
  assert.equal(
    elements.get('android-preview-time')?.textContent,
    '2026-10-19 09:15',
  );
  assert.equal(redirected, undefined);
});

test('a newly published APK updates the page without changing its source', async () => {
  const next = release('2026-10-20T11:30:00Z');
  next.assets[1].browser_download_url = `${apkUrl}?next-build`;
  const { elements } = await load('apps', [release(), next]);
  assert.equal(
    elements.get('android-preview-link')?.href,
    `${apkUrl}?next-build`,
  );
  assert.equal(
    elements.get('android-preview-time')?.textContent,
    '2026-10-20 11:30',
  );
});

test('download page still redirects to the matching APK, skipping the checksum', async () => {
  const { elements, redirected } = await load('download');
  assert.equal(redirected, apkUrl);
  assert.equal(elements.get('latest-apk-link')?.href, apkUrl);
  assert.equal(
    elements.get('latest-apk-status')?.textContent,
    'Latest signed preview: trustroots-android-preview.apk',
  );
});

for (const failure of ['http', 'network', 'empty', 'invalid'] as const) {
  test(`lookup failure (${failure}) preserves working fallback links on both pages`, async () => {
    const releases =
      failure === 'empty' ? [] : failure === 'invalid' ? {} : [release()];
    const error =
      failure === 'http' || failure === 'network' ? failure : undefined;
    const apps = await load('apps', releases, error);
    assert.equal(
      apps.elements.get('android-preview-link')?.href,
      '/apps/latest-apk/',
    );
    assert.equal(apps.elements.get('android-preview-updated')?.hidden, false);
    assert.equal(
      apps.elements.get('android-preview-updated')?.textContent,
      ' — release date currently unavailable',
    );
    const download = await load('download', releases, error);
    assert.equal(download.elements.get('latest-apk-link')?.href, releasesUrl);
    assert.equal(
      download.elements.get('latest-apk-status')?.textContent,
      'We could not look up the latest APK just now.',
    );
    assert.equal(download.redirected, undefined);
  });
}

test('both published pages load the shared release lookup', () => {
  for (const file of ['apps.md', 'latest-apk.html']) {
    const page = readFileSync(
      new URL(`../../docs/${file}`, import.meta.url),
      'utf8',
    );
    assert.match(
      page,
      /<script src="\/assets\/js\/latest-apk\.js" defer><\/script>/,
    );
  }
});
