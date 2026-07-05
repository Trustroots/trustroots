const { annotateFeature, test, expect } = require('../../support/test');

test.describe('public core manifest gap coverage', () => {
  test('support API accepts valid guest requests', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.support-submit', [
      'Support request submission succeeds with valid data.',
    ]);

    const response = await request.post('/api/support', {
      data: {
        email: 'guest-support@example.test',
        username: 'guest-support',
        message: 'E2E support request from public core coverage.',
      },
    });

    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({
      message: 'Support request sent.',
    });
  });

  test('support API surfaces send failures as validation errors', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.support-submit', [
      'Support request validation errors are shown without sending email.',
    ]);

    await page.route('**/api/support', route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message:
            'Failure while sending your support request. Please try again.',
        }),
      }),
    );

    await page.goto('/support');
    await page.getByLabel(/message/i).fill('E2E failing support request.');
    await page.getByRole('button', { name: /^send$/i }).click();

    await expect(
      page.getByText(/something went wrong sending your message/i),
    ).toBeVisible();
  });

  test('support form submits guest reports through the UI', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.support-submit', [
      'Support request submission succeeds with valid data.',
    ]);
    annotateFeature(testInfo, 'public.support-page', [
      'Support page accepts the report query parameter.',
      'Support contact form is visible.',
    ]);

    await page.goto('/support?report=e2e-seeded-shadow');
    await expect(page.getByText('Reporting member')).toBeVisible();
    await expect(page.getByText('e2e-seeded-shadow')).toBeVisible();

    await page.locator('#message').fill('E2E support report from UI coverage.');
    await page.locator('#username').fill('guest-support-ui');
    await page.locator('#email').fill('guest-support-ui@example.test');

    const supportRequest = page.waitForResponse(
      response =>
        response.url().includes('/api/support') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /^send$/i }).click();
    await supportRequest;

    await expect(page.getByText('Thank you!')).toBeVisible();
    await expect(
      page.getByText(/sent your message to our support people/i),
    ).toBeVisible();
  });

  test('service worker config renders JavaScript for visitors', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.service-worker-config', [
      'Endpoint returns JavaScript config without requiring authentication.',
    ]);

    const response = await request.get('/config/sw.js');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/javascript');
    expect(await response.text()).toMatch(/var FCM_SENDER_ID = .*;\n/);
  });

  test('legacy invite redirects to signup', async ({ request }, testInfo) => {
    annotateFeature(testInfo, 'public.legacy-invite-redirect', [
      '/invite redirects to /signup.',
    ]);

    const response = await request.get('/invite', { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe('/signup');
  });

  test('legacy tribe routes redirect to circle routes', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.legacy-tribes-redirects', [
      'Legacy /tribes route redirects to /circles.',
      'Legacy tribe detail route redirects to /circles/:circle.',
      'Known renamed legacy tribes redirect to their new circle slugs.',
      'Legacy /faq/tribes redirects to /faq/circles.',
    ]);

    const expectations = [
      ['/tribes', '/circles'],
      ['/tribes/hitchhikers', '/circles/hitchhikers'],
      ['/tribes/lgbt', '/circles/lgbtq'],
      ['/tribes/vegans-vegetarians', '/circles/veg'],
      ['/faq/tribes', '/faq/circles'],
    ];

    for (const [source, target] of expectations) {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status()).toBe(301);
      expect(response.headers().location).toBe(target);
    }
  });

  test('unknown API route returns not found', async ({ request }, testInfo) => {
    annotateFeature(testInfo, 'public.not-found', [
      'Unknown API/module/lib/developer route returns not found.',
    ]);

    const response = await request.get('/api/this-route-does-not-exist', {
      headers: { accept: 'application/json' },
    });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ message: 'Not found.' });
  });

  test('profile signup splash and circle signup suggestions load', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.signup-splash', [
      'Profile signup splash page loads for visitors.',
      'Splash page offers clear sign up and sign in actions.',
    ]);
    annotateFeature(testInfo, 'circles.signup-suggestions', [
      'Signup with tribe query preloads the suggested circle.',
      'Invalid tribe query falls back gracefully.',
    ]);

    await page.goto('/profile-signup');
    await expect(
      page.getByRole('link', { name: /become a member/i }),
    ).toBeVisible();
    await expect(
      page.locator('#profile').getByRole('link', { name: /login/i }),
    ).toBeVisible();

    await page.goto('/signup?tribe=hitchhikers');
    await expect(
      page.getByRole('heading', { name: /join trustroots/i }),
    ).toBeVisible();
    await expect(page.locator('.signup-tribe')).toBeVisible();
    await expect(page.locator('.signup-tribe')).toContainText(
      'Circle Hitchhikers',
    );

    await page.goto('/signup?tribe=not-a-real-circle');
    await expect(
      page.getByRole('heading', { name: /join trustroots/i }),
    ).toBeVisible();
    await expect(page.locator('.signup-tribe')).toBeHidden();
  });
});
