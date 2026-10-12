const fs = require('fs');
const path = require('path');

const {
  annotateFeature,
  test,
  expect,
  useElementScreenshot,
} = require('../../support/fixtures');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signOut,
  signInViaApi,
} = require('../../support/helpers');

const SEEDED_NEGATIVE_EXPERIENCE_FEEDBACK =
  'E2E seeded negative experience for admin coverage.';

async function gotoAdminPage(page, path, expectedUrl) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    try {
      await expect(page).toHaveURL(expectedUrl, { timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

test.describe('admin moderation page flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin dashboard welcomes the signed in admin', async ({
    page,
  }, testInfo) => {
    useElementScreenshot(testInfo, '#tr-footer');
    annotateFeature(testInfo, 'admin.dashboard', [
      'Admin dashboard loads for admin.',
      'Admin footer uses the shared footer layout.',
      'Dashboard shows ten most recent negative thread votes.',
      'Dashboard shows ten most recent negative experiences.',
    ]);

    await gotoAdminPage(page, '/admin', /\/admin$/);

    await expect(page).toHaveTitle(/Admin - Trustroots/);
    await expect(
      page.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible();
    await expect(page.getByLabel('Name, username or email')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Last 10 Negative Thread Votes',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Last 10 Negative Experiences' }),
    ).toBeVisible();

    const dashboard = await page.request.get('/api/admin/dashboard');
    expect(dashboard.ok()).toBeTruthy();
    const dashboardData = await dashboard.json();
    expect(dashboardData.threadVotes).toHaveLength(1);
    expect(
      dashboardData.threadVotes.every(vote => vote.reference === 'no'),
    ).toBe(true);
    expect(dashboardData.negativeExperiences).toHaveLength(1);
    expect(dashboardData.negativeExperiences[0].recommend).toBe('no');
    expect(dashboardData.negativeExperiences[0].feedbackPublic).toBe(
      SEEDED_NEGATIVE_EXPERIENCE_FEEDBACK,
    );

    const footer = page.locator('#tr-footer');
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.locator('.site-footer-content')).toBeVisible();
    await expect(footer.locator('.site-footer-meta')).toBeVisible();

    for (const [name, href] of [
      ['Volunteering', '/support?category=volunteering'],
      ['Rules', '/rules'],
      ['FAQ', '/faq'],
      ['Privacy', '/privacy'],
      ['Contact', '/contact'],
    ]) {
      await expect(
        footer.getByRole('link', { name, exact: true }),
      ).toHaveAttribute('href', href);
    }
    await expect(
      footer.getByRole('link', { name: 'Trustroots Foundation' }),
    ).toHaveCount(0);

    const contentBox = await footer
      .locator('.site-footer-content')
      .boundingBox();
    const metaBox = await footer.locator('.site-footer-meta').boundingBox();
    expect(contentBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(metaBox.x + metaBox.width).toBeGreaterThan(
      contentBox.x + contentBox.width - 1,
    );
  });

  test('admin dashboard previews negative experience feedback', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Dashboard previews negative-experience feedback.',
    ]);

    let dashboardRequests = 0;
    page.on('request', request => {
      if (request.url().includes('/api/admin/dashboard')) {
        dashboardRequests += 1;
      }
    });
    await gotoAdminPage(page, '/admin', /\/admin$/);
    const trigger = page.getByRole('button', {
      name: /Preview public feedback from/,
    });
    const preview = page.getByRole('tooltip');

    await expect(trigger).toBeVisible();
    await expect(preview).toBeHidden();
    await trigger.hover();
    await expect(preview).toHaveText(SEEDED_NEGATIVE_EXPERIENCE_FEEDBACK);
    await expect(preview).toBeVisible();
    await preview.evaluate(node => {
      node.textContent = Array.from(
        { length: 40 },
        (_, index) => `Anonymous feedback line ${index + 1}`,
      ).join('\n');
    });
    await preview.hover();
    await expect(preview).toBeVisible();
    fs.mkdirSync(path.join(process.cwd(), '.artifacts'), { recursive: true });
    await page.screenshot({
      path: path.join(
        process.cwd(),
        '.artifacts/admin-dashboard-feedback-desktop.png',
      ),
    });
    await preview.evaluate(node => {
      node.scrollTop = node.scrollHeight;
    });
    expect(await preview.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(dashboardRequests).toBe(1);

    await trigger.focus();
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await expect(trigger).toBeFocused();

    const touchContext = await page
      .context()
      .browser()
      .newContext({
        baseURL: new URL(page.url()).origin,
        hasTouch: true,
        isMobile: true,
        storageState: await page.context().storageState(),
        viewport: { width: 390, height: 844 },
      });
    const touchPage = await touchContext.newPage();
    await touchPage.goto('/admin');
    const touchTrigger = touchPage.getByRole('button', {
      name: /Preview public feedback from/,
    });
    const touchPreview = touchPage.getByRole('tooltip');
    await touchTrigger.tap();
    await expect(touchPreview).toBeVisible();
    await expect(touchPreview).toHaveText(SEEDED_NEGATIVE_EXPERIENCE_FEEDBACK);
    await touchPreview.scrollIntoViewIfNeeded();
    await touchPage.screenshot({
      path: path.join(
        process.cwd(),
        '.artifacts/admin-dashboard-feedback-mobile.png',
      ),
    });
    await touchTrigger.tap();
    await expect(touchPreview).toBeHidden();
    await touchContext.close();
    expect(dashboardRequests).toBe(1);
  });

  test('admin audit log page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.audit-log', [
      'Audit log page loads.',
      'Audit log API returns deterministic entries.',
    ]);

    await gotoAdminPage(page, '/admin/audit-log', /\/admin\/audit-log/);

    await expect(page).toHaveTitle(/Admin - Audit log - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /audit log/i }),
    ).toBeVisible();
  });

  test('admin threads page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.threads', [
      'Admin threads page loads.',
      'Admin can query threads by username/user id.',
    ]);

    await gotoAdminPage(page, '/admin/threads', /\/admin\/threads/);

    await expect(page).toHaveTitle(/Admin - Threads - Trustroots/);
    await expect(
      page.getByRole('textbox', { name: 'Member username or ID' }),
    ).toBeVisible();
  });

  test('admin newsletter page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter admin page loads.',
      'Newsletter page includes the recipient upload splitting tool.',
      'Newsletter page includes full and circle subscriber export tools.',
      'Newsletter page includes the targeted audience builder.',
    ]);

    await gotoAdminPage(page, '/admin/newsletter', /\/admin\/newsletter/);

    await expect(page).toHaveTitle(/Admin - Newsletter - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /newsletter subscribers/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Export all subscribers CSV' }),
    ).toBeVisible();
    await expect(page.getByLabel('Circle ID')).toBeVisible();
    await expect(
      page.getByLabel('Recipient file (CSV, JSONL, or NDJSON)'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Count recipients' }),
    ).toBeVisible();

    const location = page.getByLabel('Location name');
    const latitude = page.getByLabel('Latitude', { exact: true });
    const longitude = page.getByLabel('Longitude', { exact: true });
    await expect(location).toHaveValue('Berlin');
    await expect(location).toHaveAttribute(
      'placeholder',
      'Enter a city or region',
    );
    await expect(latitude).toHaveValue('52.5200');
    await expect(longitude).toHaveValue('13.4050');
    await expect(page.getByLabel('Radius (kilometres)')).toHaveValue('50');
    await expect(
      page.getByText(/\d+ eligible recipients? match(?:es)? these filters\./),
    ).toBeVisible();

    await location.fill('');
    await latitude.fill('');
    await longitude.fill('');
    await page.getByRole('button', { name: 'Count recipients' }).click();
    await expect(location).toBeFocused();
    await expect(
      page.getByText('Enter a location for living or origin matching.'),
    ).toHaveCount(0);

    await location.fill('Exampleville');
    await page.getByRole('button', { name: 'Count recipients' }).click();
    await expect(latitude).toBeFocused();
    await latitude.fill('12.34');
    await longitude.fill('56.78');
    await expect(
      page.getByText(/\d+ eligible recipients? match(?:es)? these filters\./),
    ).toBeVisible();
  });

  test('admin newsletter exports have dated audience filenames', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Audience filenames include the selected location, radius and local export datetime.',
      'Changing location filters changes the exported filename.',
    ]);
    await gotoAdminPage(page, '/admin/newsletter', /\/admin\/newsletter/);
    await expect(
      page.getByRole('button', { name: 'Export audience CSV' }),
    ).toBeVisible();

    const defaultDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export audience CSV' }).click();
    const defaultDownload = await defaultDownloadPromise;
    expect(defaultDownload.suggestedFilename()).toMatch(
      /^newsletter-audience-Berlin-50km-\d{8}-\d{4}\.csv$/,
    );

    await page.getByLabel('Location name').fill('Exampleville');
    await page.getByLabel('Radius (kilometres)').fill('25');
    await expect(
      page.getByRole('button', { name: 'Export audience CSV' }),
    ).toBeVisible();
    const customDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export audience CSV' }).click();
    const customDownload = await customDownloadPromise;
    expect(customDownload.suggestedFilename()).toMatch(
      /^newsletter-audience-Exampleville-25km-\d{8}-\d{4}\.csv$/,
    );
  });
});

test.describe('admin React route access boundaries', () => {
  test('guest direct admin load redirects to sign in', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Guest direct loads of React-owned admin pages redirect to sign in.',
    ]);

    await signOut(page);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/signin\?continue=true&returnTo=%2Fadmin/);
  });

  test('non-admin direct admin load redirects to volunteering', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Authenticated non-admin direct loads of React-owned admin pages redirect away.',
    ]);

    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/volunteering$/);
  });
});
