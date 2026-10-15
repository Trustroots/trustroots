import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type EventTemplate,
} from 'nostr-tools';

import {
  annotateFeature,
  test,
  expect,
  expectPresent,
} from '../../support/fixtures.mts';

import {
  createUser,
  registerViaApi,
  signIn,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import {
  installNostrBunkerStub,
  installNostrRelayStub,
} from '../../support/nostr.mts';

function required<Value>(value: Value | null | undefined): Value {
  expectPresent(value);
  return value;
}

// `npub1qqq…zqujme` decodes to an all-zero 32-byte public key, which is the
// canonical "valid but empty" key the server-side tests reuse.
const VALID_NPUB =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
const PUBLIC_MEMBER_NPUB =
  'npub1yg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3q2pw2gm';
// Generate this per worker so Playwright's serial-group retries cannot collide
// with an npub saved by an earlier worker attempt.
const FORM_NPUB = nip19.npubEncode(getPublicKey(generateSecretKey()));
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
      data: { nostrNpub: VALID_NPUB },
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
      data: { nostrNpub: PUBLIC_MEMBER_NPUB },
    });
    expect(update.ok()).toBeTruthy();
    expect((await update.json()).nostrNpub).toBe(PUBLIC_MEMBER_NPUB);

    const response = await request.get(
      `/.well-known/nostr.json?name=${host.username}`,
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      names: {
        [host.username]:
          '2222222222222222222222222222222222222222222222222222222222222222',
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
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/hospitality networks updated/i)).toBeVisible();

    await page.reload();
    await expect(page.locator('#nostrNpub')).toHaveValue(signerNpub);
    await page
      .getByLabel('NIP-46 bunker URI')
      .fill(`bunker://${bunkerPubkey}?relay=wss://relay.trustroots.org`);
    await page
      .getByRole('button', { name: 'Verify saved key with NIP-46' })
      .click();
    await expect(
      page.getByText('Nostr key ownership verified.').first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Nostr key ownership verified.').first(),
    ).toBeVisible();
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

  test('imports a NIP-55 public key from its correlated callback', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Members can import a public key through a correlated NIP-55 callback.',
      'The callback is scrubbed from the URL after it is processed.',
    ]);

    const signerNpub = nip19.npubEncode(getPublicKey(generateSecretKey()));
    await page.goto('/profile/edit/networks');
    await page.getByRole('button', { name: 'Use Android signer' }).click();

    const signerUri = await page
      .getByRole('link', { name: 'Open in Android signer' })
      .getAttribute('href');
    const checkedSignerUri = required(signerUri);
    const callbackUrl = new URL(
      required(
        new URLSearchParams(
          checkedSignerUri.slice(checkedSignerUri.indexOf('?') + 1),
        ).get('callbackUrl'),
      ),
    );
    const pendingRequest = await page.evaluate(() =>
      JSON.parse(
        window.sessionStorage.getItem('trustroots.nostr.pending') || 'null',
      ),
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
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/hospitality networks updated/i)).toBeVisible();
  });

  test('verifies a saved key with NIP-07, keeps the status private, and clears it when the key changes', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Members can verify ownership of a saved key through NIP-07.',
      'Verification persists in the owning member editor and remains private on public profiles.',
      'Changing the saved key clears its previous verification.',
    ]);

    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(pubkey);
    await page.exposeFunction('__e2eSignNostrEvent', (event: EventTemplate) =>
      finalizeEvent(event, secretKey),
    );
    await page.addInitScript(publicKey => {
      window.nostr = {
        getPublicKey: async () => publicKey,
        signEvent: event => window.__e2eSignNostrEvent(event),
      };
    }, pubkey);

    const save = await page.request.put('/api/users', {
      data: { nostrNpub: npub },
    });
    expect(save.ok()).toBeTruthy();
    await page.goto('/profile/edit/networks');
    await page
      .getByRole('button', { name: 'Verify saved key with browser extension' })
      .click();
    await expect(
      page.getByText('Nostr key ownership verified.').first(),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText('Nostr key ownership verified.')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    ).toHaveCount(0);

    const anonymousContext = await required(
      page.context().browser(),
    ).newContext();
    const viewerPage = await anonymousContext.newPage();
    await signInViaApi(viewerPage, anonymousContext.request, SEEDED_MEMBERS[0]);
    const publicProfile = await anonymousContext.request.get(
      new URL(`/api/users/${user.username}`, page.url()).toString(),
    );
    expect(publicProfile.ok()).toBeTruthy();
    expect(await publicProfile.json()).not.toHaveProperty('nostrVerifiedAt');
    await anonymousContext.close();

    const nextNpub = nip19.npubEncode(getPublicKey(generateSecretKey()));
    await page.locator('#nostrNpub').fill(nextNpub);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/hospitality networks updated/i)).toBeVisible();
    await expect(page.getByText('Nostr key ownership verified.')).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    ).toBeVisible();
  });

  test('rejects a NIP-07 signer whose key differs from the saved profile key', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'A signer with a different public key cannot verify the saved profile key.',
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

    const save = await page.request.put('/api/users', {
      data: { nostrNpub: savedNpub },
    });
    expect(save.ok()).toBeTruthy();
    await page.goto('/profile/edit/networks');
    await page
      .getByRole('button', { name: 'Verify saved key with browser extension' })
      .click();

    await expect(
      page.getByText('The signer key does not match the saved profile key.'),
    ).toBeVisible();
    await expect(page.getByText('Nostr key ownership verified.')).toHaveCount(
      0,
    );
  });

  test('verifies a saved key through the NIP-55 sign-event callback', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Members can verify ownership through a NIP-55 sign-event callback.',
      'The correlated Android signer callback persists verification for the saved key.',
    ]);

    const secretKey = generateSecretKey();
    const npub = nip19.npubEncode(getPublicKey(secretKey));
    const save = await page.request.put('/api/users', {
      data: { nostrNpub: npub },
    });
    expect(save.ok()).toBeTruthy();
    await page.goto('/profile/edit/networks');
    await page
      .getByRole('button', { name: 'Verify saved key with Android signer' })
      .click();

    const signerUri = await page
      .getByRole('link', { name: 'Open in Android signer' })
      .getAttribute('href');
    const checkedSignerUri = required(signerUri);
    const query = new URLSearchParams(
      checkedSignerUri.slice(checkedSignerUri.indexOf('?') + 1),
    );
    const callbackUrl = new URL(required(query.get('callbackUrl')));
    const template = JSON.parse(
      decodeURIComponent(
        checkedSignerUri.slice(
          'nostrsigner:'.length,
          checkedSignerUri.indexOf('?'),
        ),
      ),
    );
    const signedEvent = finalizeEvent(template, secretKey);
    callbackUrl.searchParams.set('nostrResult', JSON.stringify(signedEvent));
    await page.goto(callbackUrl.toString());

    await expect(page.getByText('Nostr key ownership verified.')).toBeVisible();
    await expect(page).toHaveURL(/\/profile\/edit\/networks$/);
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
      data: { nostrNpub: npub },
    });
    expect(update.ok()).toBeTruthy();

    await installNostrRelayStub(page, { events: notes });

    await page.goto(`/profile/${user.username}`);

    await expect(page.locator('.profile-nostr-badge')).toHaveText('Nostroots');
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
