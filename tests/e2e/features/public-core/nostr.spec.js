const {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} = require('nostr-tools');

const { annotateFeature, test, expect } = require('../../support/test');

const {
  createUser,
  registerViaApi,
  signIn,
  SEEDED_MEMBERS,
  signInViaApi,
} = require('../../support/helpers');
const { installNostrRelayStub } = require('../../support/nostr');
const jsQR = require('jsqr');
const sharp = require('sharp');

// `npub1qqq…zqujme` decodes to an all-zero 32-byte public key, which is the
// canonical "valid but empty" key the server-side tests reuse.
const VALID_NPUB =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
const PUBLIC_MEMBER_NPUB =
  'npub1yg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3q2pw2gm';
const FORM_NPUB =
  'npub1zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygse4sl3h';
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
  const user = createUser();

  test.beforeAll(async ({ request }) => {
    await registerViaApi(request, user);
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, user);
  });

  test('offers personalised onboarding and a scannable desktop QR above the public key field', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Network settings offer username-prefilled Nostroots onboarding.',
      'The desktop QR preserves the exact onboarding URL.',
    ]);
    await page.goto('/profile/edit/networks');
    const action = page.locator('.nostroots-onboarding');
    const link = action.getByRole('link', { name: 'Continue in Nostroots' });
    const url = `https://nos.trustroots.org/open/onboarding?username=${encodeURIComponent(
      user.username,
    )}`;
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute(
      'data-umami-event-source',
      'network-settings',
    );
    await expect(page.locator('#nostrNpub')).toBeVisible();

    const qr = action.getByRole('img', {
      name: 'Scan to continue in Nostroots on your phone',
    });
    await expect(qr).toBeVisible();
    const screenshot = await qr.screenshot();
    const { data, info } = await sharp(screenshot)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(decoded && decoded.data).toBe(url);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(link).toBeVisible();
    await expect(qr).toBeHidden();
    await expect(
      action.getByText(
        /return to this page and open the link again afterwards/,
      ),
    ).toBeVisible();

    // Exercise the real anchor without relying on a store or installed app.
    await page.route('https://nos.trustroots.org/open/onboarding**', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<h1>Onboarding test destination</h1>',
      }),
    );
    await link.click();
    await expect(page).toHaveURL(url);
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
    await input.blur();

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

test.describe('nostr community notes badge on the profile view', () => {
  test('uses the viewer identity on another profile and keeps signed-out profile access gated', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Profile note onboarding uses the viewer rather than the author.',
      'Signed-out visitors still need to sign in before viewing profiles.',
    ]);
    const author = SEEDED_MEMBERS[0];
    const viewer = SEEDED_MEMBERS[1];
    await signInViaApi(page, request, author);
    const profile = await page.request.get(`/api/users/${author.username}`);
    expect(profile.ok()).toBeTruthy();
    const originalNpub = (await profile.json()).nostrNpub || '';
    const secretKey = generateSecretKey();
    const npub = nip19.npubEncode(getPublicKey(secretKey));
    const note = finalizeEvent(
      {
        kind: 30397,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', 'onboarding-example']],
        content: 'Fictional community note for onboarding.',
      },
      secretKey,
    );
    try {
      const update = await page.request.put('/api/users', {
        data: { nostrNpub: npub },
      });
      expect(update.ok()).toBeTruthy();
      await installNostrRelayStub(page, { events: [note] });
      await signInViaApi(page, request, viewer);
      await page.goto(`/profile/${author.username}`);
      await page
        .getByRole('button', { name: /See all notes on Nostroots/ })
        .click();
      const dialog = page.getByRole('dialog', { name: 'Get Nostroots' });
      await expect(
        dialog.getByRole('link', { name: 'Continue in Nostroots' }),
      ).toHaveAttribute(
        'href',
        `https://nos.trustroots.org/open/onboarding?username=${encodeURIComponent(
          viewer.username,
        )}`,
      );
      await expect(
        dialog.getByRole('link', { name: 'Continue in Nostroots' }),
      ).toHaveAttribute('data-umami-event-source', 'profile-notes');

      await page.context().clearCookies();
      await page.goto(`/profile/${author.username}`);
      await expect(page).toHaveURL(/\/signin/);
      await expect(
        page.getByRole('link', { name: 'Continue in Nostroots' }),
      ).toHaveCount(0);
    } finally {
      await signInViaApi(page, request, author);
      const restore = await page.request.put('/api/users', {
        data: { nostrNpub: originalNpub },
      });
      expect(restore.ok()).toBeTruthy();
    }
  });

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

    const user = createUser();
    await registerViaApi(request, user);
    await signIn(page, user);

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
