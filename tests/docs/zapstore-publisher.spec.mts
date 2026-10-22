import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { certificate } from '../../docs/src/zapstore-publisher.mts';
import { publisher } from '../../docs/src/android-release-metadata.mts';

type Event = {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  id?: string;
  sig?: string;
};
type Options = {
  wrongIdentity?: boolean;
  noSigner?: boolean;
  rejectSigning?: boolean;
  alterEvent?: boolean;
  corruptApk?: boolean;
  failUpload?: boolean;
  rejectRelay?: boolean;
  alreadyPublished?: boolean;
  missingReadback?: boolean;
  invalidHash?: boolean;
};
const bytes = Buffer.from('Fictional APK for browser publication');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const candidate = {
  appId: 'org.trustroots.android',
  version: '0.1-20261022-1200',
  versionCode: 100050,
  filename: 'trustroots-android-0.1-20261022-1200.apk',
  url: 'https://github.com/Trustroots/trustroots/releases/download/android-preview-100050-v0.1-20261022-1200/trustroots-android-0.1-20261022-1200.apk',
  sha256,
  size: bytes.length,
  certificate,
  minSdk: 26,
  targetSdk: 37,
  platforms: ['android-arm64-v8a'],
  published: '2026-10-22T12:00:00Z',
};

async function setup(page: Page, options: Options = {}) {
  const signed: Event[] = [];
  const accepted: Event[] = [];
  let uploaded = false;
  let uploads = 0;
  let readbackRequested = false;
  await page.exposeFunction('testSignEvent', (event: Event) => {
    if (options.rejectSigning) throw new Error('Signing declined');
    signed.push(event);
    const id = createHash('sha256')
      .update(
        JSON.stringify([
          0,
          event.pubkey,
          event.created_at,
          event.kind,
          event.tags,
          event.content,
        ]),
      )
      .digest('hex');
    return {
      ...event,
      id: options.invalidHash ? '0'.repeat(64) : id,
      sig: '0'.repeat(128),
      ...(options.alterEvent ? { content: 'changed' } : {}),
    };
  });
  await page.addInitScript(
    ({ publisher, options }) => {
      if (options.noSigner) return;
      Object.assign(window, {
        nostr: {
          getPublicKey: async () =>
            options.wrongIdentity ? '0'.repeat(64) : publisher,
          signEvent: (event: unknown) =>
            (
              window as unknown as {
                testSignEvent: (value: unknown) => Promise<unknown>;
              }
            ).testSignEvent(event),
        },
      });
    },
    { publisher, options },
  );
  await page.routeWebSocket('wss://relay.zapstore.dev', socket => {
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message[0] === 'REQ' && message[1] === 'android-version') {
        socket.send(
          JSON.stringify([
            'EVENT',
            'android-version',
            {
              kind: 30063,
              pubkey: publisher,
              created_at: 100,
              tags: [
                ['i', 'org.trustroots.android'],
                ['c', 'beta'],
                [
                  'version',
                  options.alreadyPublished
                    ? candidate.version
                    : '0.1-20261001-1200',
                ],
              ],
            },
          ]),
        );
        socket.send(JSON.stringify(['EOSE', 'android-version']));
      } else if (message[0] === 'EVENT') {
        const event = message[1] as Event;
        accepted.push(event);
        socket.send(
          JSON.stringify([
            'OK',
            event.id,
            !options.rejectRelay,
            options.rejectRelay ? 'rejected' : '',
          ]),
        );
      } else if (message[0] === 'REQ' && message[1] === 'published-preview') {
        // Relay serialisation order need not match the signer's object order.
        readbackRequested = true;
        if (options.missingReadback) return;
        const event = accepted.find(event => event.id === message[2].ids[0]);
        if (event)
          socket.send(
            JSON.stringify([
              'EVENT',
              'published-preview',
              Object.fromEntries(Object.entries(event).reverse()),
            ]),
          );
      }
    });
  });
  await page.route('http://localhost:4188/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/apps/zapstore-candidate.json')
      return route.fulfill({ json: candidate });
    if (path.startsWith('/assets/downloads/'))
      return route.fulfill({
        body: options.corruptApk ? Buffer.alloc(bytes.length) : bytes,
      });
    if (path.startsWith('/assets/js/'))
      return route.fulfill({
        contentType: 'text/javascript',
        body: await readFile(
          new URL(`../../docs${path}`, import.meta.url),
          'utf8',
        ),
      });
    const source = await readFile(
      new URL('../../docs/apps.md', import.meta.url),
      'utf8',
    );
    return route.fulfill({
      contentType: 'text/html',
      body: `<html><body>${source.slice(source.indexOf('<details>'), source.indexOf('To receive updates'))}</body></html>`,
    });
  });
  await page.route('https://cdn.zapstore.dev/**', async route => {
    if (route.request().method() === 'HEAD')
      return route.fulfill({ status: uploaded ? 200 : 404 });
    uploads++;
    if (options.failUpload) return route.fulfill({ status: 503 });
    expect(route.request().headers().authorization).toMatch(/^Nostr /);
    expect(route.request().postDataBuffer()).toEqual(bytes);
    uploaded = true;
    return route.fulfill({
      json: { sha256, url: `https://cdn.zapstore.dev/${sha256}` },
    });
  });
  await page.goto('http://localhost:4188/apps/');
  await page
    .getByText('Publish an Android preview to Zapstore (maintainers)')
    .click();
  await expect(
    page.getByRole('button', { name: 'Publish preview to Zapstore' }),
  ).toBeEnabled();
  return {
    signed,
    accepted,
    uploads: () => uploads,
    readbackRequested: () => readbackRequested,
  };
}

test('maintainer reviews, signs, uploads and receives a confirmed publication', async ({
  page,
}) => {
  const result = await setup(page);
  await expect(page.locator('#zapstore-candidate')).toContainText(
    candidate.version,
  );
  await expect(page.locator('#zapstore-candidate')).toContainText(sha256);
  expect(result.signed).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Publish preview to Zapstore' })
    .click();
  await expect(page.getByRole('status')).toHaveText(
    `Published version ${candidate.version} to Zapstore.`,
  );
  expect(result.signed.map(event => event.kind)).toEqual([24242, 3063, 30063]);
  expect(result.accepted.map(event => event.kind)).toEqual([3063, 30063]);
  const asset = result.accepted[0];
  expect(result.accepted[1].tags).toContainEqual([
    'e',
    asset.id,
    'wss://relay.zapstore.dev',
  ]);
  expect(result.uploads()).toBe(1);
});

for (const [option, expected] of [
  ['noSigner', 'NIP-07'],
  ['wrongIdentity', 'Select the Trustroots publisher identity'],
  ['rejectSigning', 'Signing declined'],
  ['alterEvent', 'different event'],
  ['invalidHash', 'invalid event hash'],
  ['corruptApk', 'failed its hash check'],
  ['failUpload', 'APK upload failed'],
  ['rejectRelay', 'Zapstore rejected'],
] as const) {
  test(`publication handles ${option} without reporting success and allows retry`, async ({
    page,
  }) => {
    const result = await setup(page, { [option]: true });
    const button = page.getByRole('button', {
      name: 'Publish preview to Zapstore',
    });
    await button.click();
    await expect(page.getByRole('status')).toContainText(expected);
    await expect(button).toBeEnabled();
    if (option !== 'rejectRelay') expect(result.accepted).toHaveLength(0);
    if (option === 'rejectRelay') {
      expect(result.uploads()).toBe(1);
      await button.click();
      await expect(page.getByRole('status')).toContainText(expected);
      expect(result.uploads()).toBe(1);
    }
  });
}

test('already published preview requests no event signatures', async ({
  page,
}) => {
  const result = await setup(page, { alreadyPublished: true });
  await page
    .getByRole('button', { name: 'Publish preview to Zapstore' })
    .click();
  await expect(page.getByRole('status')).toHaveText(
    `Version ${candidate.version} is already available in Zapstore.`,
  );
  expect(result.signed).toHaveLength(0);
  expect(result.uploads()).toBe(0);
});

test('positive acknowledgements without release readback do not report success', async ({
  page,
}) => {
  await page.clock.install();
  const result = await setup(page, { missingReadback: true });
  await page
    .getByRole('button', { name: 'Publish preview to Zapstore' })
    .click();
  await expect.poll(result.readbackRequested).toBe(true);
  await page.clock.fastForward(16000);
  await expect(page.getByRole('status')).toContainText(
    'did not confirm the publication',
  );
  await expect(
    page.getByRole('button', { name: 'Publish preview to Zapstore' }),
  ).toBeEnabled();
});
