import { devices, type Page } from '@playwright/test';
import { expect, expectPresent, test } from '../../support/fixtures.mts';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';

const apkPage = 'https://team.trustroots.org/apps/latest-apk/';
const linkName = 'Download Android preview (APK)';

async function expectAndroidLinkBelowNavigation(page: Page) {
  const header = page.locator('#tr-header');
  const link = header.getByRole('link', { name: linkName });
  await expect(link).toBeInViewport({ ratio: 1 });
  await expect(link).toHaveAttribute('href', apkPage);
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
  const navigation = await header.locator(':scope > .container').boundingBox();
  const download = await link.boundingBox();
  expectPresent(navigation);
  expectPresent(download);
  expect(download.y).toBeGreaterThanOrEqual(navigation.y + navigation.height);
}

test.describe('Android browser', () => {
  test.use({
    userAgent: devices['Pixel 7'].userAgent,
    viewport: { width: 320, height: 780 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Playwright changes the user agent but can report the host platform in client hints.
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'Android' },
      });
    });
  });

  test('guest can open the signed preview download from home', async ({
    page,
  }) => {
    await page.route(apkPage, route => route.fulfill({ body: 'APK page' }));
    await page.goto('/');
    await expectAndroidLinkBelowNavigation(page);

    await page.getByRole('link', { name: linkName }).tap();
    await expect(page).toHaveURL(apkPage);
  });

  test('member sees the download link on a direct visit to Messages', async ({
    page,
  }) => {
    await signInViaApi(page, undefined, SEEDED_MEMBERS[0]);
    await page.goto('/messages');
    await expect(page).toHaveURL('/messages');
    await expectAndroidLinkBelowNavigation(page);
    const header = await page.locator('#tr-header').boundingBox();
    const inbox = page.getByRole('navigation', { name: 'Conversation filter' });
    await expect(inbox).toBeVisible();
    const controls = await inbox.boundingBox();
    expectPresent(header);
    expectPresent(controls);
    expect(controls.y).toBeGreaterThanOrEqual(header.y + header.height);
  });
});

for (const device of ['iPhone 13', 'Desktop Chrome']) {
  test.describe(device, () => {
    test.use({
      userAgent: devices[device].userAgent,
      viewport: devices[device].viewport,
    });

    test('header omits the APK link', async ({ page }) => {
      if (device === 'iPhone 13') {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'userAgentData', {
            value: undefined,
          });
        });
      }
      await page.goto('/');
      await expect(page.locator('#tr-header')).toBeVisible();
      await expect(page.getByRole('link', { name: linkName })).toHaveCount(0);
    });
  });
}
