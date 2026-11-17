import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type EventTemplate,
  verifyEvent,
} from 'nostr-tools';

import { annotateFeature, test, expect } from '../../support/fixtures.mts';

import {
  createUser,
  registerViaApi,
  signIn,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import {
  createNostrProof,
  installNostrBunkerStub,
  installNostrRelayStub,
} from '../../support/nostr.mts';

declare global {
  interface Window {
    signProfileChallenge(
      event: EventTemplate,
    ): Promise<ReturnType<typeof finalizeEvent>>;
  }
}

const PRIVATE_MEMBER_KEY = generateSecretKey();
const PUBLIC_MEMBER_KEY = generateSecretKey();
const FORM_KEY = generateSecretKey();
const VALID_NPUB = nip19.npubEncode(getPublicKey(PRIVATE_MEMBER_KEY));
const PUBLIC_MEMBER_NPUB = nip19.npubEncode(getPublicKey(PUBLIC_MEMBER_KEY));
const FORM_NPUB = nip19.npubEncode(getPublicKey(FORM_KEY));

async function externalFormProof(
  page: import('@playwright/test').Page,
  key: Uint8Array,
) {
  await page.getByLabel('Signing method').selectOption('external');
  await page.getByRole('button', { name: 'Create signing challenge' }).click();
  const challenge = page.getByLabel('Challenge to sign');
  await expect(challenge).toBeVisible();
  await page
    .getByLabel('Signed event JSON')
    .fill(
      JSON.stringify(
        finalizeEvent(JSON.parse(await challenge.inputValue()), key),
      ),
    );
}
// A secret key (nsec) must never be accepted in place of a public key.
const NSEC = 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav';

test.describe('nostr NIP-05 .well-known endpoint', () => {
  test('rejects a non-string username with a 400', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.nostr-well-known', [
      'Invalid name query returns 400.',
    ]);

    const response = await request.get('/.well-known/nostr.json?name[$ne]=x');

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Valid username required.',
    });
  });

  test('rejects an empty username with a 400', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.nostr-well-known', [
      'Invalid name query returns 400.',
    ]);

    const response = await request.get('/.well-known/nostr.json?name=');

    expect(response.status()).toBe(400);
  });

  test('returns empty names with an open CORS header for unknown users', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.nostr-well-known', [
      'Unknown user returns an empty names object with CORS headers.',
    ]);

    const response = await request.get(
      `/.well-known/nostr.json?name=nobody${Date.now()}`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(await response.json()).toEqual({ names: {} });
  });

  test('does not expose npubs for non-public (unconfirmed) members', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.nostr-well-known', [
      'Unconfirmed or hidden users are not exposed.',
    ]);

    // Freshly registered members stay non-public until they confirm their
    // email, so even with a saved npub the endpoint must fail closed.
    const user = createUser();
    await registerViaApi(request, user);
    await signIn(page, user);

    // Save the npub through the authenticated API (page.request shares the
    // signed-in session cookie), avoiding a second slow trip through the form.
    const update = await page.request.put('/api/users', {
      data: {
        nostrNpub: VALID_NPUB,
        nostrProof: await createNostrProof(page.request, PRIVATE_MEMBER_KEY),
      },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).nostrNpub).toBe(VALID_NPUB);

    const response = await request.get(
      `/.well-known/nostr.json?name=${user.username}`,
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ names: {} });
  });

  test('exposes npubs for confirmed public members', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.nostr-well-known', [
      'Public member with a valid npub is exposed as NIP-05 hex key.',
    ]);

    const host = SEEDED_MEMBERS[0];
    await signInViaApi(page, request, host);

    const update = await page.request.put('/api/users', {
      data: {
        nostrNpub: PUBLIC_MEMBER_NPUB,
        nostrProof: await createNostrProof(page.request, PUBLIC_MEMBER_KEY),
      },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).nostrNpub).toBe(PUBLIC_MEMBER_NPUB);

    const response = await request.get(
      `/.well-known/nostr.json?name=${host.username}`,
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      names: {
        [host.username]: getPublicKey(PUBLIC_MEMBER_KEY),
      },
    });
  });
});

test.describe.serial('nostr npub on the profile networks form', () => {
  const user = SEEDED_MEMBERS[2];

  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, user);
  });

  test('shows a validation error when a secret key is entered', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
      'Invalid Nostr secret key is rejected.',
      'Valid npub is saved and shown on profile view.',
    ]);

    await page.goto('/profile/edit/networks');

    const input = page.locator('#nostrNpub');
    await expect(input).toBeVisible({ timeout: 30000 });

    await input.fill(NSEC);
    await page.locator('.profile-editor-save').click();

    await expect(page.getByText(/invalid nostr key/i)).toBeVisible();
  });

  test('links a browser signer without entering a public key', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
    ]);
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    await page.exposeFunction('signProfileChallenge', (event: EventTemplate) =>
      finalizeEvent(event, secret),
    );
    await page.addInitScript(key => {
      window.nostr = {
        getPublicKey: async () => key,
        signEvent: event => window.signProfileChallenge(event),
      };
    }, pubkey);
    await page.goto('/profile/edit/networks');
    await page
      .getByRole('button', { name: 'Link with browser signer' })
      .click();
    await expect(page.getByText(/networks updated/i)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('nostr npub')).toHaveValue(
      nip19.npubEncode(pubkey),
    );
  });

  test('saves a valid npub and persists it across reloads', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
      'Invalid Nostr secret key is rejected.',
      'Valid npub is saved and shown on profile view.',
    ]);

    await page.goto('/profile/edit/networks');

    const input = page.locator('#nostrNpub');
    await expect(input).toBeVisible();

    await input.fill(FORM_NPUB);
    await externalFormProof(page, FORM_KEY);
    await page.locator('.profile-editor-save').click();

    await expect(page.getByText(/networks updated/i)).toBeVisible();

    await page.goto('/profile/edit/networks');
    await expect(page.locator('#nostrNpub')).toHaveValue(FORM_NPUB);
  });

  test('canonicalizes uppercase npubs when saving networks', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
      'Valid npub is saved and shown on profile view.',
    ]);

    await page.goto('/profile/edit/networks');

    const input = page.locator('#nostrNpub');
    await expect(input).toBeVisible();

    await input.fill(FORM_NPUB.toUpperCase());
    await page.locator('.profile-editor-save').click();

    await expect(page.getByText(/networks updated/i)).toBeVisible();

    await page.goto('/profile/edit/networks');
    await expect(page.locator('#nostrNpub')).toHaveValue(FORM_NPUB);
  });

  test('rejects an npub already saved by another member', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
      'Valid npub is saved and shown on profile view.',
    ]);

    await signInViaApi(page, request, SEEDED_MEMBERS[1]);
    await page.goto('/profile/edit/networks');

    const input = page.locator('#nostrNpub');
    await expect(input).toBeVisible();

    await input.fill(FORM_NPUB);
    await externalFormProof(page, FORM_KEY);
    await page.locator('.profile-editor-save').click();

    await expect(
      page.getByText(
        'This nostr npub is already in use. Please use another one.',
      ),
    ).toBeVisible();
  });

  test('links the saved npub to nos.trustroots.org on the profile view', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
      'Invalid Nostr secret key is rejected.',
      'Valid npub is saved and shown on profile view.',
    ]);

    await page.goto(`/profile/${user.username}`);

    const nostrAddress = `${user.username}@trustroots.org`;
    await expect(
      page
        .locator('.elsewhere-profiles')
        .getByRole('link', { name: 'Nostroots' }),
    ).toHaveAttribute(
      'href',
      `https://nos.trustroots.org/v0/#profile/${encodeURIComponent(
        nostrAddress,
      )}`,
    );
  });
});

test.describe.serial('Nostr signer profile flows', () => {
  const user = SEEDED_MEMBERS[2];

  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, user);
    await page.request.put('/api/users', { data: { nostrNpub: '' } });
  });

  test('imports and saves the public key returned by a NIP-46 bunker', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Members can import a public key from a NIP-46 bunker.',
      'The suggested key remains a draft until explicitly accepted and saved.',
      'Members can prove ownership of a new key using a NIP-46 signer when saving the profile.',
    ]);

    const bunkerSecretKey = generateSecretKey();
    const signerSecretKey = generateSecretKey();
    const signerNpub = nip19.npubEncode(getPublicKey(signerSecretKey));
    const { bunkerPubkey } = await installNostrBunkerStub(page, {
      bunkerSecretKey,
      signerSecretKey,
    });

    await page.goto('/profile/edit/networks');
    await page
      .getByLabel('NIP-46 bunker URI')
      .fill(`bunker://${bunkerPubkey}?relay=wss://relay.trustroots.org`);
    await page.getByRole('button', { name: 'Connect with NIP-46' }).click();

    await expect(page.locator('.nostr-signer-suggestion')).toContainText(
      signerNpub,
    );
    await expect(page.locator('#nostrNpub')).toHaveValue('');
    await page.getByRole('button', { name: 'Use this npub' }).click();
    await expect(page.locator('#nostrNpub')).toHaveValue(signerNpub);
    const saveRequest = page.waitForRequest(
      request =>
        request.url().endsWith('/api/users') && request.method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/hospitality networks updated/i)).toBeVisible();
    const saveBody = await (await saveRequest).postDataJSON();
    expect(saveBody.nostrNpub).toBe(signerNpub);
    expect(saveBody.nostrProof).toMatchObject({
      pubkey: getPublicKey(signerSecretKey),
      kind: 27235,
    });
    expect(verifyEvent(saveBody.nostrProof)).toBe(true);

    await page.reload();
    await expect(page.locator('#nostrNpub')).toHaveValue(signerNpub);
  });

  test('completes generated Nostr Connect pairing through the local encrypted relay', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Members can pair with a signer through a generated Nostr Connect URI.',
      'The pairing URI is delivered over an encrypted local NIP-46 relay exchange.',
    ]);

    const bunkerSecretKey = generateSecretKey();
    const signerSecretKey = generateSecretKey();
    const signerNpub = nip19.npubEncode(getPublicKey(signerSecretKey));
    await installNostrBunkerStub(page, { bunkerSecretKey, signerSecretKey });

    await page.goto('/profile/edit/networks');
    await page.getByRole('button', { name: 'Show Nostr Connect QR' }).click();
    const uri = await page.getByLabel('Nostr Connect URI').inputValue();
    const parsedUri = new URL(uri);
    const clientPubkey = parsedUri.hostname;
    const secret = parsedUri.searchParams.get('secret');
    expect(secret).toBeTruthy();

    await page.waitForFunction(() =>
      [...window.__e2eNostrSockets].some(socket => socket.__e2eSubs.size),
    );
    await page.evaluate(
      async ({ clientPubkey: pubkey, secret: responseSecret }) => {
        const event = await window.__e2eCreateNostrConnectHandshake(
          pubkey,
          responseSecret,
        );
        window.__e2eInjectNostrRelayEvent(event);
      },
      { clientPubkey, secret },
    );

    await expect(page.locator('.nostr-signer-suggestion')).toContainText(
      signerNpub,
    );
    await page.getByRole('button', { name: 'Use this npub' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/hospitality networks updated/i)).toBeVisible();
    await page.reload();
    await expect(page.locator('#nostrNpub')).toHaveValue(signerNpub);
  });

  test('imports a NIP-55 key and saves it with a signed profile challenge', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Members can import a public key through a correlated NIP-55 callback.',
      'The callback is scrubbed from the URL after it is processed.',
      'Members can prove ownership of a new key using a NIP-55 signer when saving the profile.',
    ]);

    const signerSecretKey = generateSecretKey();
    const signerNpub = nip19.npubEncode(getPublicKey(signerSecretKey));
    await page.goto('/profile/edit/networks');
    await page.getByRole('button', { name: 'Use Android signer' }).click();

    const signerUri = await page
      .getByRole('link', { name: 'Open in Android signer' })
      .getAttribute('href');
    const callbackUrl = new URL(
      new URL(signerUri!).searchParams.get('callbackUrl')!,
    );
    const pendingRequest = await page.evaluate(() =>
      JSON.parse(window.sessionStorage.getItem('trustroots.nostr.pending')!),
    );
    expect(pendingRequest.operationId).toBe(
      callbackUrl.searchParams.get('nostrOperation'),
    );
    callbackUrl.searchParams.set('nostrResult', signerNpub);
    await page.goto(callbackUrl.toString());

    await expect(page).toHaveURL(/\/profile\/edit\/networks$/);
    await expect(page.locator('.nostr-signer-suggestion')).toContainText(
      signerNpub,
    );
    await expect(page.locator('#nostrNpub')).toHaveValue('');
    await page.getByRole('button', { name: 'Use this npub' }).click();

    await page.getByLabel('Signing method').selectOption('nip55');
    const saveRequest = page.waitForRequest(
      request =>
        request.url().endsWith('/api/users') && request.method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save' }).click();
    const proofLink = page.getByRole('link', {
      name: 'Open in Android signer',
    });
    await expect(proofLink).toBeVisible();
    const proofUri = (await proofLink.getAttribute('href'))!;
    const proofQuery = new URLSearchParams(
      proofUri.slice(proofUri.indexOf('?') + 1),
    );
    const proofCallback = new URL(proofQuery.get('callbackUrl')!);
    const challenge = JSON.parse(
      decodeURIComponent(
        proofUri.slice('nostrsigner:'.length, proofUri.indexOf('?')),
      ),
    );
    const signedProof = finalizeEvent(challenge, signerSecretKey);
    const serialisedProof = JSON.stringify(signedProof);
    proofCallback.searchParams.set('nostrResult', serialisedProof);
    await page.goto(proofCallback.toString());
    const saveBody = await (await saveRequest).postDataJSON();
    expect(saveBody.nostrNpub).toBe(signerNpub);
    expect(saveBody.nostrProof).toEqual(JSON.parse(serialisedProof));
    expect(verifyEvent(saveBody.nostrProof)).toBe(true);
    await expect(page.getByText(/hospitality networks updated/i)).toBeVisible();
    await page.reload();
    await expect(page.locator('#nostrNpub')).toHaveValue(signerNpub);
  });

  test('rejects a mismatched NIP-07 signer before updating the profile', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'A signer with a different public key cannot prove ownership of the profile key being saved.',
    ]);

    const savedSecretKey = generateSecretKey();
    const otherSecretKey = generateSecretKey();
    const savedNpub = nip19.npubEncode(getPublicKey(savedSecretKey));
    const otherPubkey = getPublicKey(otherSecretKey);
    await page.exposeFunction('__e2eSignNostrEvent', (event: EventTemplate) =>
      finalizeEvent(event, otherSecretKey),
    );
    await page.addInitScript(publicKey => {
      window.nostr = {
        getPublicKey: async () => publicKey,
        signEvent: event => window.__e2eSignNostrEvent(event),
      };
    }, otherPubkey);

    await page.goto('/profile/edit/networks');
    await page.locator('#nostrNpub').fill(savedNpub);
    const profileUpdates: string[] = [];
    page.on('request', request => {
      if (request.url().endsWith('/api/users') && request.method() === 'PUT') {
        profileUpdates.push(request.url());
      }
    });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByText('The signer public key does not match this npub.'),
    ).toBeVisible();
    expect(profileUpdates).toHaveLength(0);
  });
});

test.describe('nostr community notes badge on the profile view', () => {
  test('shows the Nostroots badge and recent notes for a member with map notes', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Profile view surfaces the Nostroots badge for members with map notes.',
      'Recent community notes are listed on the profile from the relay.',
    ]);

    // Generate a keypair so we can return validly-signed events the client will
    // accept (nostr-tools verifies signatures before delivering events).
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(pubkey);
    const now = Math.floor(Date.now() / 1000);

    const notes = [
      finalizeEvent(
        {
          kind: 30397,
          created_at: now - 3600,
          tags: [['d', 'e2e-note-1']],
          content: 'E2E profile note: sunny rooftop with great coffee.',
        },
        secretKey,
      ),
      finalizeEvent(
        {
          kind: 30397,
          created_at: now - 7200,
          tags: [['d', 'e2e-note-2']],
          content: 'E2E profile note: quiet park, perfect for reading.',
        },
        secretKey,
      ),
    ];

    const user = SEEDED_MEMBERS[0];
    await signInViaApi(page, request, user);

    const update = await page.request.put('/api/users', {
      data: {
        nostrNpub: npub,
        nostrProof: await createNostrProof(page.request, secretKey),
      },
    });
    expect(update.ok()).toBeTruthy();

    await installNostrRelayStub(page, { events: notes });

    await page.goto(`/profile/${user.username}`);

    await expect(
      page.locator('[data-slot="badge"]', { hasText: 'Nostroots' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent community notes' }),
    ).toBeVisible();
    await expect(
      page.getByText('E2E profile note: sunny rooftop with great coffee.'),
    ).toBeVisible();
    await expect(
      page.getByText('E2E profile note: quiet park, perfect for reading.'),
    ).toBeVisible();
  });
});

test('saves a new npub through a browser signer and rejects unsigned API changes', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.edit-networks', [
    'Networks edit form is reachable.',
    'Valid npub is saved and shown on profile view.',
    'Members can prove ownership of a new key using a browser signer when saving the profile.',
  ]);
  const member = createUser();
  await registerViaApi(request, member);
  await signIn(page, member);
  const key = generateSecretKey();
  const pubkey = getPublicKey(key);
  const npub = nip19.npubEncode(pubkey);
  await page.exposeFunction(
    'signOwnershipEvent',
    (event: import('nostr-tools').EventTemplate) => finalizeEvent(event, key),
  );
  await page.addInitScript(publicKey => {
    const browser = window as unknown as {
      nostr: unknown;
      signOwnershipEvent: (event: unknown) => Promise<unknown>;
    };
    browser.nostr = {
      getPublicKey: async () => publicKey,
      signEvent: (event: unknown) => browser.signOwnershipEvent(event),
    };
  }, pubkey);
  expect(
    (
      await page.request.put('/api/users', { data: { nostrNpub: npub } })
    ).status(),
  ).toBe(400);
  await page.goto('/profile/edit/networks');
  await page.locator('#nostrNpub').fill(npub);
  const saveRequest = page.waitForRequest(
    request =>
      request.url().endsWith('/api/users') && request.method() === 'PUT',
  );
  await page.locator('.profile-editor-save').click();
  await expect(page.getByText(/networks updated/i)).toBeVisible();
  const saveBody = await (await saveRequest).postDataJSON();
  expect(saveBody.nostrNpub).toBe(npub);
  expect(saveBody.nostrProof).toMatchObject({ pubkey, kind: 27235 });
  expect(verifyEvent(saveBody.nostrProof)).toBe(true);
  await page.reload();
  await expect(page.locator('#nostrNpub')).toHaveValue(npub);
});
