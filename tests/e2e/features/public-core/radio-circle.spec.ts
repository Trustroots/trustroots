/* global window, HTMLMediaElement */
import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import type { Page } from '@playwright/test';
import { installNostrRelayStub } from '../../support/nostr.mts';
import { SEEDED_ADMIN, signInViaApi } from '../../support/helpers.mts';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type EventTemplate,
} from 'nostr-tools';
declare global {
  interface Window {
    __radioMedia: { played: number; paused: number; loaded: number };
    __radioPublished: ReturnType<typeof finalizeEvent>[];
    signRadioFixtureEvent(
      template: EventTemplate,
    ): Promise<ReturnType<typeof finalizeEvent>>;
  }
}

async function prepareRadio(page: Page, unavailable = false) {
  const key = generateSecretKey();
  const created_at = Math.floor(Date.now() / 1000);
  const events = [
    finalizeEvent(
      {
        kind: 1,
        created_at,
        content: 'A fictional radio message',
        tags: [
          ['t', 'radiostr'],
          ['channel', 'groovesalad'],
        ],
      },
      key,
    ),
    finalizeEvent(
      {
        kind: 1,
        created_at,
        content: 'A fictional Hackers message',
        tags: [['t', 'trustroots-circle-hackers']],
      },
      key,
    ),
    finalizeEvent(
      {
        kind: 1,
        created_at,
        content: 'Groovesalad',
        tags: [
          ['t', 'radiostr'],
          ['t', 'nowplaying'],
          ['radiostr_station', 'groovesalad'],
        ],
      },
      key,
    ),
  ];
  for (const relayUrl of [
    'wss://relay.trustroots.org',
    'wss://relay.nomadwiki.org',
  ]) {
    await installNostrRelayStub(page, {
      events,
      relayUrl,
      unavailable,
      acceptPublishes: true,
    });
  }
  await page.route('**/api/tribes/radio', route =>
    route.fulfill({
      json: {
        _id: 'fictional-radio-circle',
        slug: 'radio',
        label: 'Radio',
        count: 0,
        description: 'Listen together.',
      },
    }),
  );
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'fictional-hackers-circle',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
      },
    }),
  );
  await page.addInitScript(() => {
    window.__radioPublished = [];
    window.addEventListener('nostr-test-published', event =>
      window.__radioPublished.push(
        (event as CustomEvent<ReturnType<typeof finalizeEvent>>).detail,
      ),
    );
    window.__radioMedia = { played: 0, paused: 0, loaded: 0 };
    HTMLMediaElement.prototype.play = function () {
      window.__radioMedia.played++;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.__radioMedia.paused++;
    };
    HTMLMediaElement.prototype.load = function () {
      window.__radioMedia.loaded++;
    };
  });
}

test('visitors can play radio, save favourites and see a deduplicated count without social identities', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.radio', [
    'Visitors can listen, save favourites and see shared listener counts.',
  ]);
  await prepareRadio(page);
  await page.goto('/circles/radio#groovesalad');
  const radio = page.getByRole('region', { name: 'Trustroots Radio' });
  await expect(
    radio.getByText('One shared listener', { exact: true }),
  ).toBeVisible();
  await expect(radio.getByRole('region', { name: 'Radio chat' })).toHaveCount(
    0,
  );
  await expect(
    radio.getByRole('region', { name: 'Listening now' }),
  ).toHaveCount(0);
  await expect(page.getByText('A fictional radio message')).toHaveCount(0);
  expect(await page.evaluate(() => window.__radioMedia.played)).toBe(0);
  const soma = radio.getByRole('region', { name: 'SomaFM' });
  await soma
    .getByRole('button', { name: 'Play Groovesalad', exact: true })
    .click();
  await expect(
    radio.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await expect(
    radio.getByText('2 listeners, including you on this device'),
  ).toBeVisible();
  await soma
    .getByRole('button', { name: 'Star Groovesalad', exact: true })
    .click();
  await expect(radio.getByRole('region', { name: 'Favourites' })).toContainText(
    'Groovesalad',
  );
  await page.reload();
  await expect(radio.getByRole('region', { name: 'Favourites' })).toContainText(
    'Groovesalad',
  );
  await expect(
    radio.getByRole('button', { name: 'Play', exact: true }),
  ).toBeVisible();
});

test('a matching Trustroots Nostr signer can chat, share favourites and announce listening', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.radio', [
    'A matching verified signer can publish chat, favourites and listening activity.',
    'A matching NIP-07 extension connects automatically.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  const key = generateSecretKey();
  const publicKey = getPublicKey(key);
  const profile = await page.request.put('/api/users', {
    headers: { 'X-Trustroots-Request': '1' },
    data: { nostrNpub: nip19.npubEncode(publicKey) },
  });
  expect(profile.ok()).toBe(true);
  await prepareRadio(page);
  await page.exposeFunction(
    'signRadioFixtureEvent',
    (template: EventTemplate) => finalizeEvent(template, key),
  );
  await page.addInitScript(publicKey => {
    window.nostr = {
      getPublicKey: async () => publicKey,
      signEvent: template => window.signRadioFixtureEvent(template),
    };
  }, publicKey);
  try {
    await page.goto('/circles/radio');
    const radio = page.getByRole('region', { name: 'Trustroots Radio' });
    await expect(radio.getByRole('status')).toContainText(
      `${SEEDED_ADMIN.username}@trustroots.org`,
    );
    await expect(radio.getByText('A fictional Hackers message')).toHaveCount(0);
    await radio
      .getByLabel('Message')
      .fill('A fictional shared listening message');
    await radio.getByRole('button', { name: 'Send' }).click();
    await expect(
      radio.getByText('A fictional shared listening message'),
    ).toBeVisible();
    await expect(
      radio.getByRole('link', { name: nip19.npubEncode(publicKey) }),
    ).toHaveAttribute('href', `/profile/${SEEDED_ADMIN.username}`);
    const soma = radio.getByRole('region', { name: 'SomaFM' });
    await soma
      .getByRole('button', { name: 'Star Groovesalad', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__radioPublished.some(event =>
            event.tags.some(tag => tag[0] === 't' && tag[1] === 'favorite'),
          ),
        ),
      )
      .toBe(true);
    await soma
      .getByRole('button', { name: 'Play Groovesalad', exact: true })
      .click();
    await expect(
      radio.getByText('2 listeners, including you on this device'),
    ).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__radioPublished.some(event =>
              event.tags.some(tag => tag[0] === 't' && tag[1] === 'nowplaying'),
            ),
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    await expect(
      radio.getByText('2 shared listeners', { exact: true }),
    ).toBeVisible();
  } finally {
    await page.request.put('/api/users', {
      headers: { 'X-Trustroots-Request': '1' },
      data: { nostrNpub: '' },
    });
  }
});

test('logged-in members can read radio chat but need a matching signer to publish', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.radio', [
    'Chat and listener identities require login.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await prepareRadio(page);
  await page.goto('/circles/radio');
  const radio = page.getByRole('region', { name: 'Trustroots Radio' });
  const message = radio.getByRole('listitem').filter({
    hasText: 'A fictional radio message',
  });
  await expect(message).toBeVisible();
  await expect(message.locator('strong')).toHaveText(/^npub1[0-9a-z]+$/);
  await expect(message.locator('time')).toHaveText(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
  );
  await expect(message).toContainText('UTC');
  const hashtag = message.getByRole('link', { name: '#groovesalad' });
  await expect(hashtag).toHaveAttribute('href', '/circles/radio#groovesalad');
  await hashtag.click();
  await expect(page).toHaveURL(/\/circles\/radio#groovesalad$/);
  await expect(
    radio.getByRole('heading', { name: 'Groovesalad' }),
  ).toBeVisible();
  await expect(
    radio.getByRole('region', { name: 'Listening now' }),
  ).toContainText('Groovesalad');
  await expect(radio.getByLabel('Message')).toBeDisabled();
  await radio.getByRole('button', { name: 'Connect Nostr identity' }).click();
  await expect(radio.getByRole('alert')).toContainText(
    'Connect a Nostr extension',
  );
  await expect(radio.getByLabel('Message')).toBeDisabled();
});

test('radio remains playable when the shared room is unavailable and stops on navigation', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.radio', [
    'Playback survives relay failures and stops when leaving the circle.',
    'Local playback contributes to the listener count immediately.',
  ]);
  await prepareRadio(page, true);
  await page.goto('/circles/radio');
  const radio = page.getByRole('region', { name: 'Trustroots Radio' });
  await expect(radio.getByRole('status')).toContainText(
    'radio room is unavailable',
  );
  await radio
    .getByRole('region', { name: 'SomaFM' })
    .getByRole('button', { name: 'Play Groovesalad', exact: true })
    .click();
  await expect(
    radio.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await expect(
    radio.getByText('One listener, including you on this device'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'More circles' }).click();
  await expect(page).toHaveURL(/\/circles$/);
  await expect(radio).toHaveCount(0);
  expect(await page.evaluate(() => window.__radioMedia.loaded)).toBeGreaterThan(
    0,
  );
});

test('Hackers chat requires sign-in and publishes separately from Radio', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.hackers-chat', [
    'Visitors see a sign-in link, and members can read without a signer.',
    'A verified signer posts to Hackers without publishing to Radio.',
  ]);
  await prepareRadio(page);
  await page.goto('/circles/hackers');
  const chat = page.getByRole('region', { name: 'Hackers chat' });
  await expect(
    chat.getByRole('link', { name: 'Log in to see chat.' }),
  ).toBeVisible();
  await expect(chat.getByText('A fictional Hackers message')).toHaveCount(0);

  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles/hackers');
  await expect(chat.getByText('A fictional Hackers message')).toHaveCount(1);
  await expect(chat.getByText('A fictional radio message')).toHaveCount(0);
  await expect(chat.getByLabel('Message')).toBeDisabled();

  const key = generateSecretKey();
  const publicKey = getPublicKey(key);
  const profile = await page.request.put('/api/users', {
    headers: { 'X-Trustroots-Request': '1' },
    data: { nostrNpub: nip19.npubEncode(publicKey) },
  });
  expect(profile.ok()).toBe(true);
  await page.exposeFunction(
    'signRadioFixtureEvent',
    (template: EventTemplate) => finalizeEvent(template, key),
  );
  await page.addInitScript(publicKey => {
    window.nostr = {
      getPublicKey: async () => publicKey,
      signEvent: template => window.signRadioFixtureEvent(template),
    };
  }, publicKey);
  try {
    await page.reload();
    await expect(chat.getByLabel('Message')).toBeEnabled();
    await chat.getByLabel('Message').fill('Hello from a fictional hacker');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByText('Hello from a fictional hacker')).toHaveCount(
      1,
    );
    const published = await page.evaluate(() => window.__radioPublished);
    expect(published).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Hello from a fictional hacker',
          tags: [['t', 'trustroots-circle-hackers']],
        }),
      ]),
    );
  } finally {
    await page.request.put('/api/users', {
      headers: { 'X-Trustroots-Request': '1' },
      data: { nostrNpub: '' },
    });
  }
});
