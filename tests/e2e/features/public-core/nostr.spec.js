const { annotateFeature, test, expect } = require('../../support/test');

const {
  createUser,
  registerViaApi,
  signIn,
  SEEDED_MEMBERS,
  signInViaApi,
} = require('../../support/helpers');

// `npub1qqq…zqujme` decodes to an all-zero 32-byte public key, which is the
// canonical "valid but empty" key the server-side tests reuse.
const VALID_NPUB =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
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
      data: { nostrNpub: VALID_NPUB },
    });
    expect(update.ok()).toBeTruthy();

    const response = await request.get(
      `/.well-known/nostr.json?name=${host.username}`,
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      names: {
        [host.username]:
          '0000000000000000000000000000000000000000000000000000000000000000',
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
      page.getByRole('link', { name: nostrAddress }),
    ).toHaveAttribute(
      'href',
      `https://nos.trustroots.org/v0/#profile/${encodeURIComponent(
        nostrAddress,
      )}`,
    );
  });
});
