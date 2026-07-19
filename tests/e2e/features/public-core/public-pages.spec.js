const { annotateFeature, test, expect } = require('../../support/test');

const { createUser, waitForTribesList } = require('../../support/helpers');

test.describe('public pages and unauthenticated flows', () => {
  test('sign in and sign up pages link to each other', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signin', [
      'Sign in page links to signup.',
      'Username sign in succeeds.',
      'Email sign in succeeds.',
      'Continue query redirects to the original protected destination.',
    ]);

    await page.goto('/signin');

    await page
      .getByRole('link', { name: /become a member/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole('heading', { name: /join trustroots/i }),
    ).toBeVisible();

    await page.getByRole('link', { name: /^login$/i }).click();
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('forgot password page renders the recovery form', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-forgot', [
      'Forgot password page renders.',
      'Valid reset request sends a deterministic reset email/stub.',
      'Invalid or unknown account request does not leak account existence.',
    ]);

    await page.goto('/password/forgot');

    await expect(page).toHaveTitle(/Reset password - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /restore your password/i }),
    ).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByRole('button', { name: /restore/i })).toBeVisible();
  });

  test('signing in with invalid credentials shows an error and stays on the sign in page', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.invalid-credentials', [
      'Invalid username/password response is surfaced to the user.',
      'User remains on the sign in page.',
    ]);

    const user = createUser();

    await page.goto('/signin');
    await page.locator('#username').fill(user.username);
    await page.locator('#password').fill('definitely-wrong-password');

    const signInResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/auth/signin') &&
        response.status() === 400,
    );
    await page.getByRole('button', { name: /login/i }).click();
    await signInResponse;

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('unknown routes render the not found page', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.not-found', [
      'Unknown client route redirects to /not-found.',
      'Unknown API/module/lib/developer route returns not found.',
    ]);

    await page.goto('/this-route-does-not-exist');

    await expect(page).toHaveURL(/\/not-found/);
    await expect(
      page.getByRole('heading', { name: /this page cannot be found/i }),
    ).toBeVisible();
  });

  test('visiting an authenticated route while signed out redirects to sign in', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.protected-route-redirect', [
      'Visiting a protected member route while signed out redirects to /signin.',
    ]);

    await page.goto('/messages');

    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('circles page lists seeded tribes', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'circles.list', [
      'Circles list loads for visitors.',
    ]);

    await page.goto('/circles');
    await waitForTribesList(page);

    await expect(page).toHaveURL(/\/circles/);
    await expect(
      page.locator('h3.tribe-label', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('h3.tribe-label', { hasText: 'Cyclists' }).first(),
    ).toBeVisible();
  });

  for (const { path: pagePath, title, feature } of [
    {
      path: '/faq',
      title: /FAQ - Site & community - Trustroots/,
      feature: {
        id: 'public.faq-general',
        scenarios: ['General FAQ page loads.'],
      },
    },
    {
      path: '/faq/circles',
      title: /FAQ - Circles - Trustroots/,
      feature: {
        id: 'public.faq-circles',
        scenarios: ['Circles FAQ page loads.'],
      },
    },
    {
      path: '/faq/foundation',
      title: /FAQ - Foundation - Trustroots/,
      feature: {
        id: 'public.faq-foundation',
        scenarios: ['Foundation FAQ page loads.'],
      },
    },
    {
      path: '/faq/technology',
      title: /FAQ - Technology - Trustroots/,
      feature: {
        id: 'public.faq-technology',
        scenarios: ['Technology FAQ page loads.'],
      },
    },
    {
      path: '/faq/bugs-and-features',
      title: /FAQ - Bugs & Features - Trustroots/,
      feature: {
        id: 'public.faq-bugs-and-features',
        scenarios: ['Bugs and features FAQ page loads.'],
      },
    },
    {
      path: '/contribute',
      title: /Contribute - Trustroots/,
      feature: {
        id: 'public.contribute',
        scenarios: ['Contribute page loads with the expected title/content.'],
      },
    },
    {
      path: '/team',
      title: /Team - Trustroots/,
      feature: {
        id: 'public.team',
        scenarios: [
          'Team page loads.',
          'Volunteers API returns the data used by the public team page.',
        ],
      },
    },
    {
      path: '/privacy',
      title: /Privacy policy - Trustroots/,
      feature: {
        id: 'public.privacy',
        scenarios: ['Privacy page loads with the expected title/content.'],
      },
    },
    {
      path: '/rules',
      title: /Rules - Trustroots/,
      feature: {
        id: 'public.rules',
        scenarios: ['Rules page loads with the expected title/content.'],
      },
    },
    {
      path: '/guide',
      title: /Guide - Trustroots/,
      feature: {
        id: 'public.guide',
        scenarios: ['Guide page loads.'],
      },
    },
    {
      path: '/foundation',
      title: /Foundation - Trustroots/,
      feature: {
        id: 'public.foundation',
        scenarios: ['Foundation page loads.'],
      },
    },
    {
      path: '/media',
      title: /Media - Trustroots/,
      feature: {
        id: 'public.media',
        scenarios: ['Media page loads.'],
      },
    },
    {
      path: '/volunteering',
      title: /Volunteering - Trustroots/,
      feature: {
        id: 'public.volunteering',
        scenarios: ['Volunteering page loads.'],
      },
    },
    { path: '/support', title: /Support - Trustroots/ },
    { path: '/contact', title: /Contact us - Trustroots/ },
  ]) {
    test(`public marketing page ${pagePath} loads`, async ({
      page,
      request,
    }, testInfo) => {
      if (feature) {
        annotateFeature(testInfo, feature.id, feature.scenarios);
      }

      await page.goto(pagePath);

      await expect(page).toHaveURL(new RegExp(pagePath.replace(/\//g, '\\/')));
      await expect(page).toHaveTitle(title);

      if (pagePath === '/team') {
        const volunteers = await request.get('/api/volunteers');
        expect(volunteers.ok()).toBeTruthy();
        const body = await volunteers.json();
        expect(Array.isArray(body.volunteers)).toBeTruthy();
        expect(Array.isArray(body.alumni)).toBeTruthy();
      }
    });
  }

  test('support page renders the contact form', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'public.support-page', [
      'Support page loads for visitors.',
      'Support page accepts the report query parameter.',
      'Support contact form is visible.',
    ]);

    await page.goto('/support');

    await expect(
      page.getByRole('heading', { name: /trustroots support/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /contact us/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^send$/i })).toBeVisible();
  });

  test('invalid password reset page explains the link is no longer valid', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-reset-invalid', [
      'Invalid reset page explains that the link is no longer valid.',
      'Invalid reset page links back to password recovery.',
    ]);

    await page.goto('/password/reset/invalid');

    await expect(page).toHaveURL(/\/password\/reset\/invalid/);
    await expect(
      page.getByRole('heading', { name: /password reset is invalid/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /ask for a new password reset/i }),
    ).toHaveAttribute('href', '/password/forgot');
  });

  test('/about redirects to the homepage', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'public.about-redirect', [
      '/about redirects to the homepage.',
    ]);

    await page.goto('/about');

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page).toHaveTitle(/Trustroots/);
  });
});
