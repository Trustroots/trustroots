/* global window, HTMLMediaElement */
import {
  annotateFeature,
  captureSection,
  expect,
  test,
} from '../../support/fixtures.mts';
import type { Page } from '@playwright/test';
import {
  createNostrProof,
  installNostrRelayStub,
} from '../../support/nostr.mts';
import { SEEDED_ADMIN, signInViaApi } from '../../support/helpers.mts';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type Event,
  verifyEvent,
} from 'nostr-tools';
declare global {
  interface Window {
    __radioMedia: { played: number; paused: number; loaded: number };
    __radioPublished: ReturnType<typeof finalizeEvent>[];
    __extensionCalls: string[];
  }
}

const volunteeringMessage = '<strong>Fictional volunteering message</strong>';

async function prepareRadio(page: Page, unavailable = false) {
  await stubArtworkImages(page);
  const key = generateSecretKey();
  const authorPublicKey = getPublicKey(key);
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
        content: volunteeringMessage,
        tags: [['t', 'trustroots-volunteering']],
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
  const serviceKey = generateSecretKey();
  const servicePubkey = getPublicKey(serviceKey);
  const privateEvents: Event[] = events.slice(0, 3);
  const topics: Record<string, string> = {
    radio: 'radiostr',
    hackers: 'trustroots-circle-hackers',
    volunteering: 'trustroots-volunteering',
    hitchhikers: 'trustroots-circle-hitchhikers',
  };
  const privatePublishes: Event[] = [];
  const failNext = { read: false, write: false };
  await page.route('**/api/tribes/chat/*', async route => {
    const room = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const topic = topics[room];
    if (route.request().method() === 'POST') {
      if (failNext.write) {
        failNext.write = false;
        await route.fulfill({ status: 503, json: {} });
        return;
      }
      const { content, channel } = route.request().postDataJSON();
      const tags = [
        ['t', topic],
        ['trustroots_username', SEEDED_ADMIN.username],
      ];
      if (channel) tags.push(['channel', channel]);
      const event = finalizeEvent(
        { kind: 1, created_at, tags, content },
        serviceKey,
      );
      privateEvents.push(event);
      privatePublishes.push(event);
      await route.fulfill({ status: 201, json: event });
      return;
    }
    if (failNext.read) {
      failNext.read = false;
      await route.fulfill({ status: 503, json: {} });
      return;
    }
    await route.fulfill({
      json: {
        servicePubkey,
        messages: privateEvents.filter(event =>
          event.tags.some(tag => tag[0] === 't' && tag[1] === topic),
        ),
      },
    });
  });
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
  await page.route('**/api/users/memberships/fictional-*-circle', route =>
    route.fulfill({
      json: {
        user: {
          memberIds: [
            new URL(route.request().url()).pathname.split('/').at(-1),
          ],
        },
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
  return { authorPublicKey, privatePublishes, servicePubkey, failNext };
}

async function joinCircle(page: Page, label: string) {
  await page
    .getByRole('button', { name: `Join (${label})`, exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Join circle', exact: true })
    .click();
}

async function stubArtworkImages(page: Page) {
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    'base64',
  );
  await page.route('https://somafm.com/**', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: pixel }),
  );
  await page.route('https://radioparadise.com/**', route =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: pixel }),
  );
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
  const soma = radio.getByRole('region', { name: 'SomaFM' });
  const beatblenderWebsite = soma.getByRole('link', {
    name: 'Beatblender website',
  });
  await expect(beatblenderWebsite).toHaveAttribute(
    'href',
    'https://somafm.com/beatblender',
  );
  const beatblenderArtwork = beatblenderWebsite.locator('img');
  await beatblenderWebsite.scrollIntoViewIfNeeded();
  await expect(beatblenderArtwork).toHaveAttribute(
    'src',
    'https://somafm.com/img/blender.gif',
  );
  await expect
    .poll(() =>
      beatblenderArtwork.evaluate(node => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      }),
    )
    .toBe(true);
  await expect(beatblenderWebsite.locator('button')).toHaveCount(0);
  const paradise = radio.getByRole('region', { name: 'Radio Paradise' });
  const paradiseWebsite = paradise.getByRole('link', {
    name: 'Paradise website',
  });
  await expect(paradiseWebsite).toHaveAttribute(
    'href',
    'https://www.radioparadise.com/',
  );
  const paradiseArtwork = paradiseWebsite.locator('img');
  await paradiseWebsite.scrollIntoViewIfNeeded();
  await expect(paradiseArtwork).toHaveAttribute(
    'src',
    'https://radioparadise.com/apple-touch-icon.png',
  );
  await expect
    .poll(() =>
      paradiseArtwork.evaluate(node => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      }),
    )
    .toBe(true);
  await expect(soma.getByRole('button', { name: 'Play 7soul' })).toContainText(
    '7s',
  );
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

test('a linked member can chat, listen and save favourites without the extension', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.radio', [
    'A linked member can post with their Trustroots account.',
    'Playback and local favourites work without browser-extension calls or public relay writes.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await linkChatKey(page);
  const { privatePublishes, servicePubkey, failNext } =
    await prepareRadio(page);
  failNext.read = true;
  try {
    await page.clock.install();
    await page.goto('/circles/radio');
    await joinCircle(page, 'Radio');
    const radio = page.getByRole('region', { name: 'Trustroots Radio' });
    const chat = radio.getByRole('region', { name: 'Radio chat' });
    await expect(chat.getByText('Could not load chat messages.')).toBeVisible();
    await chat.getByRole('button', { name: 'Retry loading messages' }).click();
    await expect(chat.getByText('A fictional radio message')).toBeVisible();
    await expect(chat.getByText('A fictional Hackers message')).toHaveCount(0);
    expect(await page.evaluate(() => window.__extensionCalls)).toEqual([]);

    const draft = 'A fictional shared listening message';
    const input = chat.getByLabel('Message');
    const send = chat.getByRole('button', { name: 'Send' });
    failNext.write = true;
    await input.fill(draft);
    await send.click();
    await expect(chat.getByRole('alert')).toContainText(
      'Message could not be sent',
    );
    await expect(input).toHaveValue(draft);
    await send.click();
    const posted = chat.getByRole('listitem').filter({ hasText: draft });
    await expect(posted).toContainText(
      `${SEEDED_ADMIN.username} via Trustroots`,
    );
    await expect(input).toBeEmpty();
    expect(privatePublishes).toEqual([
      expect.objectContaining({ content: draft, pubkey: servicePubkey }),
    ]);
    expect(verifyEvent(privatePublishes[0])).toBe(true);

    const soma = radio.getByRole('region', { name: 'SomaFM' });
    await soma
      .getByRole('button', { name: 'Star Groovesalad', exact: true })
      .click();
    await expect(
      soma.getByRole('button', { name: 'Unstar Groovesalad', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await soma
      .getByRole('button', { name: 'Play Groovesalad', exact: true })
      .click();
    await expect(
      radio.getByText('2 listeners, including you on this device'),
    ).toBeVisible();
    await page.clock.fastForward(11_000);
    expect(await page.evaluate(() => window.__radioPublished)).toEqual([]);
    expect(await page.evaluate(() => window.__extensionCalls)).toEqual([]);
    await page.reload();
    await expect(
      soma.getByRole('button', { name: 'Unstar Groovesalad', exact: true }),
    ).toBeVisible();
  } finally {
    await unlinkChatKey(page);
  }
});

test('logged-in members can read and post in Radio without a Nostr key', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.radio', [
    'Chat and listener identities require login.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  const { authorPublicKey } = await prepareRadio(page);
  await page.goto('/circles/radio');
  await joinCircle(page, 'Radio');
  const radio = page.getByRole('region', { name: 'Trustroots Radio' });
  const message = radio.getByRole('listitem').filter({
    hasText: 'A fictional radio message',
  });
  await expect(message).toBeVisible();
  const unknownNpub = nip19.npubEncode(authorPublicKey);
  await expect(message.locator('strong')).toHaveText(unknownNpub);
  await expect(message.getByRole('link', { name: unknownNpub })).toHaveCount(0);
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
    radio.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await expect(radio.locator('audio')).toHaveAttribute('src', /groovesalad/);
  await hashtag.click();
  await expect(
    radio.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__radioMedia.played)).toBe(1);
  const listeningNow = radio.getByRole('region', { name: 'Listening now' });
  await expect(listeningNow).toContainText('Groovesalad');
  await expect(listeningNow).toContainText(unknownNpub);
  await radio.getByLabel('Message').fill('Fictional keyless radio chat');
  await radio.getByRole('button', { name: 'Send' }).click();
  const posted = radio
    .getByRole('listitem')
    .filter({ hasText: 'Fictional keyless radio chat' });
  await expect(posted).toContainText(`${SEEDED_ADMIN.username} via Trustroots`);
  await expect(
    posted.getByRole('link', { name: '#groovesalad' }),
  ).toBeVisible();
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

async function linkChatKey(page: Page) {
  const key = generateSecretKey();
  const publicKey = getPublicKey(key);
  const profile = await page.request.put('/api/users', {
    headers: { 'X-Trustroots-Request': '1' },
    data: {
      nostrNpub: nip19.npubEncode(publicKey),
      nostrProof: await createNostrProof(page.request, key),
    },
  });
  expect(profile.ok()).toBe(true);
  await page.addInitScript(() => {
    window.__extensionCalls = [];
    window.nostr = {
      getPublicKey: async () => {
        window.__extensionCalls.push('getPublicKey');
        throw new Error('Fictional extension access denied');
      },
      signEvent: async () => {
        window.__extensionCalls.push('signEvent');
        throw new Error('Fictional extension access denied');
      },
    };
  });
}

async function unlinkChatKey(page: Page) {
  await page.request.put('/api/users', {
    headers: { 'X-Trustroots-Request': '1' },
    data: { nostrNpub: '' },
  });
}

test('Hackers chat requires sign-in and publishes separately from Radio', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.hackers-chat', [
    'Visitors see a sign-in link, and signed-in accounts must join to read chat.',
    'Trustroots signs a linked member’s post on the Hackers topic.',
  ]);
  const { authorPublicKey, privatePublishes } = await prepareRadio(page);
  await page.goto('/circles/hackers');
  const chat = page.getByRole('region', { name: 'Hackers chat' });
  await expect(
    chat.getByRole('link', { name: 'Log in to see chat.' }),
  ).toBeVisible();
  await expect(chat.getByText('A fictional Hackers message')).toHaveCount(0);

  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles/hackers');
  await expect(
    chat.getByText(/Join this circle using the Join button/),
  ).toBeVisible();
  await expect(chat.getByText('A fictional Hackers message')).toHaveCount(0);
  await expect(chat.getByLabel('Message')).toHaveCount(0);

  await linkChatKey(page);
  try {
    await page.reload();
    await joinCircle(page, 'Hackers');
    await expect(chat).toContainText(
      'Messages are visible to people with access to the Trustroots relay.',
    );
    await expect(chat.getByText('A fictional Hackers message')).toHaveCount(1);
    const unknownNpub = nip19.npubEncode(authorPublicKey);
    await expect(chat.getByText(unknownNpub, { exact: true })).toBeVisible();
    await expect(chat.getByRole('link', { name: unknownNpub })).toHaveCount(0);
    await expect(chat.getByText('A fictional radio message')).toHaveCount(0);
    await expect(chat.getByLabel('Message')).toBeEnabled();
    await chat.getByLabel('Message').fill('Hello from a fictional hacker');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByText('Hello from a fictional hacker')).toHaveCount(
      1,
    );
    await expect(
      chat.getByText(`${SEEDED_ADMIN.username} via Trustroots`),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__extensionCalls)).toEqual([]);
    expect(privatePublishes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Hello from a fictional hacker',
          tags: [
            ['t', 'trustroots-circle-hackers'],
            ['trustroots_username', SEEDED_ADMIN.username],
          ],
        }),
      ]),
    );
  } finally {
    await unlinkChatKey(page);
  }
});

test('volunteering chat reads and publishes on its own Nostr topic', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.volunteering', [
    'Visitors see a sign-in link, and members can read volunteering chat without a signer.',
    'Trustroots signs a linked member’s post on the volunteering topic.',
  ]);
  const { privatePublishes } = await prepareRadio(page);
  await page.goto('/volunteers');
  await expect(page).toHaveURL(/\/volunteering$/);
  const chat = page.getByRole('region', { name: 'Volunteering chat' });
  await expect(chat.getByText(volunteeringMessage)).toHaveCount(0);
  await chat.getByRole('link', { name: 'Log in to see chat.' }).click();
  await page.getByLabel('Email or username').fill(SEEDED_ADMIN.username);
  await page
    .getByLabel('Password', { exact: true })
    .fill(SEEDED_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await expect(page).toHaveURL(/\/volunteering$/);
  await expect(chat).toContainText(
    'Messages are visible to people with access to the Trustroots relay.',
  );
  const message = chat.getByText(volunteeringMessage, { exact: true });
  await expect(message).toBeVisible();
  await expect(message.locator('strong')).toHaveCount(0);
  await expect(chat.getByText('A fictional Hackers message')).toHaveCount(0);
  await expect(chat.getByText('A fictional radio message')).toHaveCount(0);
  await expect(chat.getByLabel('Message')).toBeEnabled();

  await linkChatKey(page);
  try {
    await page.reload();
    await expect(chat.getByLabel('Message')).toBeEnabled();
    await chat.getByLabel('Message').fill('Hello from a fictional volunteer');
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(
      chat.getByText('Hello from a fictional volunteer'),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__extensionCalls)).toEqual([]);
    expect(privatePublishes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Hello from a fictional volunteer',
          tags: [
            ['t', 'trustroots-volunteering'],
            ['trustroots_username', SEEDED_ADMIN.username],
          ],
        }),
      ]),
    );
  } finally {
    await unlinkChatKey(page);
  }
});

test('Hitchhikers chat is available only while the account belongs to the circle', async ({
  page,
}) => {
  await prepareRadio(page);
  const path = '/circles/hitchhikers';
  const chatPath = '/api/tribes/chat/hitchhikers';
  const headers = { 'X-Trustroots-Request': '1' };
  await page.goto(path);
  const chat = page.getByRole('region', { name: 'Hitchhikers chat' });
  await expect(
    chat.getByRole('link', { name: 'Log in to see chat.' }),
  ).toBeVisible();
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.reload();
  const circleResponse = await page.request.get('/api/tribes/hitchhikers');
  const { _id: circleId } = await circleResponse.json();
  try {
    await expect(
      chat.getByText(/Join this circle using the Join button/),
    ).toBeVisible();
    await expect(chat.getByLabel('Message')).toHaveCount(0);
    expect((await page.request.get(chatPath)).status()).toBe(403);
    expect(
      (
        await page.request.post(chatPath, {
          headers,
          data: { content: 'Fictional chat before joining' },
        })
      ).status(),
    ).toBe(403);

    await joinCircle(page, 'Hitchhikers');
    const message = 'A fictional hitchhiking question';
    await chat.getByLabel('Message').fill(message);
    await chat.getByRole('button', { name: 'Send' }).click();
    await expect(chat.getByText(message)).toBeVisible();
    await expect(
      chat.getByText(`${SEEDED_ADMIN.username} via Trustroots`),
    ).toBeVisible();
    await captureSection(chat, 'hitchhikers-mixed-chat');

    await page
      .getByRole('button', { name: 'Leave circle', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave circle', exact: true })
      .click();
    await expect(
      chat.getByText(/Join this circle using the Join button/),
    ).toBeVisible();
    await expect(chat.getByText(message)).toHaveCount(0);
    expect((await page.request.get(chatPath)).status()).toBe(403);
  } finally {
    await page.request.delete(`/api/users/memberships/${circleId}`, {
      headers,
    });
  }
});
