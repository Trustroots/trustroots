import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import {
  releasesApi,
  selectPreview,
  zapstoreRelease,
  publisher,
} from '../../docs/src/android-release-metadata.mts';

const source = stripTypeScriptTypes(
  readFileSync(
    new URL('../../docs/src/latest-apk.mts', import.meta.url),
    'utf8',
  ),
).replace(/^import[\s\S]*?;\n/, '');
const releasesUrl = 'https://github.com/Trustroots/trustroots/releases';
const apkUrl = `${releasesUrl}/download/android-preview-100001/trustroots-android-preview.apk`;

function release(published = '2026-10-19T09:15:30Z') {
  return {
    name: 'Android preview 0.1-20261019-0900',
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
          'android-preview-version',
          'android-zapstore-version',
          'android-preview-link',
          'android-preview-updated',
          'android-preview-time',
        ]
      : ['latest-apk-link', 'latest-apk-status'];
  for (const id of ids) {
    elements.set(id, {
      href: page === 'apps' ? '/apps/latest-apk/' : releasesUrl,
      hidden: id !== 'android-preview-updated',
      textContent:
        id === 'android-preview-version' ? ' — version 0.1-20261001-1200' : '',
      dateTime: '',
    });
  }
  let redirected: string | undefined;
  runInNewContext(source, {
    releasesApi,
    selectPreview,
    zapstoreRelease: async () => ({ version: '0.1-20261005-2310' }),
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
  assert.equal(
    elements.get('android-preview-version')?.textContent,
    ' — version 0.1-20261019-0900',
  );
  assert.equal(
    elements.get('android-zapstore-version')?.textContent,
    ' — version 0.1-20261005-2310',
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
      apps.elements.get('android-preview-version')?.textContent,
      ' — version 0.1-20261001-1200',
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
      /<script src="\/assets\/js\/latest-apk\.mjs" type="module"><\/script>/,
    );
  }
});

class RelaySocket {
  static instance: RelaySocket;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent = '';
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    RelaySocket.instance = this;
  }
  send(value: string) {
    this.sent = value;
  }
  close() {
    this.closed = true;
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

function zapEvent(version: string, created_at: number, pubkey = publisher) {
  return {
    kind: 30063,
    pubkey,
    created_at,
    tags: [
      ['i', 'org.trustroots.android'],
      ['c', 'beta'],
      ['version', version],
    ],
  };
}

test('Zapstore reports only the newest beta from the Trustroots publisher', async () => {
  const result = zapstoreRelease(RelaySocket as unknown as typeof WebSocket);
  const socket = RelaySocket.instance;
  socket.onopen?.();
  const filter = JSON.parse(socket.sent)[2];
  assert.deepEqual(filter.authors, [publisher]);
  assert.deepEqual(filter['#c'], ['beta']);
  socket.message(['EVENT', 'android-version', zapEvent('old', 100)]);
  socket.message(['EVENT', 'android-version', zapEvent('current', 200)]);
  socket.message([
    'EVENT',
    'android-version',
    zapEvent('other publisher', 300, 'other'),
  ]);
  socket.message([
    'EVENT',
    'other-subscription',
    zapEvent('wrong subscription', 400),
  ]);
  socket.message([
    'EVENT',
    'android-version',
    { ...zapEvent('other app', 500), tags: [['i', 'example.app']] },
  ]);
  socket.onmessage?.({ data: 'invalid json' });
  socket.message(['EOSE', 'android-version']);
  assert.deepEqual(await result, {
    version: 'current',
    published: '1970-01-01T00:03:20.000Z',
  });
  assert.equal(socket.closed, true);
});

for (const failure of ['empty', 'error', 'close'] as const) {
  test(`Zapstore ${failure} leaves the verified site snapshot available`, async () => {
    const result = zapstoreRelease(RelaySocket as unknown as typeof WebSocket);
    const rejected = assert.rejects(result);
    const socket = RelaySocket.instance;
    if (failure === 'empty') socket.message(['EOSE', 'android-version']);
    if (failure === 'error') socket.onerror?.();
    if (failure === 'close') socket.onclose?.();
    await rejected;
    assert.equal(socket.closed, true);
  });
}

test('both channel versions are rendered without JavaScript and Zapstore links directly to the app', () => {
  const page = readFileSync(
    new URL('../../docs/apps.md', import.meta.url),
    'utf8',
  );
  assert.match(page, /https:\/\/zapstore\.dev\/apps\/org\.trustroots\.android/);
  assert.match(page, /site\.data\.android_releases\.download\.version/);
  assert.match(page, /site\.data\.android_releases\.zapstore\.version/);
});
