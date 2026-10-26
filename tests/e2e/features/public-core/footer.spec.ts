/* global document, getComputedStyle */
import {
  expectPresent,
  annotateFeature,
  expect,
  test,
  useElementScreenshot,
  useViewportScreenshot,
} from '../../support/fixtures.mts';

test.describe('public footer', () => {
  test('standard footer shows compact links and build metadata on desktop', async ({
    page,
  }, testInfo) => {
    useElementScreenshot(testInfo, '#tr-footer');
    annotateFeature(testInfo, 'public.footer', [
      'Standard footer shows compact public links on desktop.',
      'Standard footer omits the Contribute navigation link.',
      'Standard footer links to the deployed GitHub commit.',
    ]);

    await page.addInitScript(
      build => {
        let settings: Record<string, unknown> = {};
        Object.defineProperty(window, 'settings', {
          configurable: true,
          get: () => settings,
          set: value => {
            settings = { ...value, build };
          },
        });
      },
      {
        commitUrl:
          'https://github.com/Trustroots/trustroots/commit/abcdef0123456789abcdef0123456789abcdef01',
        committedAt: '2026-10-21 00:00',
        shortCommit: 'abcdef0',
      },
    );
    await page.goto('/faq');

    const footer = page.locator('#tr-footer');
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();

    for (const [name, href] of [
      ['Volunteering', '/support?category=volunteering'],
      ['Rules', '/rules'],
      ['Safety', '/safety'],
      ['FAQ', '/faq'],
      ['Privacy', '/privacy'],
      ['Credits', '/credits'],
      ['Contact', '/contact'],
    ]) {
      await expect(
        footer.getByRole('link', { name, exact: true }),
      ).toHaveAttribute('href', href);
    }

    await expect(footer.getByRole('link', { name: 'Contribute' })).toHaveCount(
      0,
    );
    await expect(
      footer.getByRole('link', { name: 'Trustroots Foundation' }),
    ).toHaveCount(0);
    await expect(footer.locator('.icon-github')).toHaveCount(1);
    const githubIconFont = await footer
      .locator('.icon-github')
      .evaluate(async icon => {
        const style = getComputedStyle(icon, '::before');
        const faces = await document.fonts.load('16px tricons', '\ue822');
        return {
          content: style.content,
          family: style.fontFamily,
          statuses: faces.map(face => face.status),
        };
      });
    expect(githubIconFont.family).toContain('tricons');
    expect(githubIconFont.content).not.toBe('none');
    expect(githubIconFont.statuses).toEqual(['loaded']);
    await expect(
      footer.getByRole('link', { name: /currently deployed code/i }),
    ).toHaveAttribute(
      'href',
      /https:\/\/github\.com\/Trustroots\/trustroots\/commit\/[0-9a-f]{40}/,
    );

    const contentBox = await footer
      .locator('.site-footer-content')
      .boundingBox();
    const metaBox = await footer.locator('.site-footer-meta').boundingBox();
    expect(contentBox).not.toBeNull();
    expectPresent(contentBox);
    expect(metaBox).not.toBeNull();
    expectPresent(metaBox);
    expect(metaBox.x + metaBox.width).toBeGreaterThan(
      contentBox.x + contentBox.width - 1,
    );
  });

  test('credits page is accessible from the footer', async ({ page }) => {
    await page.goto('/faq');
    await page
      .locator('#tr-footer')
      .getByRole('link', { name: 'Credits', exact: true })
      .click();
    await expect(page).toHaveURL(/\/credits$/);
    await expect(
      page.getByRole('heading', { name: 'Credits', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/This product includes GeoLite2 data/),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'MaxMind' })).toHaveAttribute(
      'href',
      'https://www.maxmind.com',
    );
    await expect(
      page.getByRole('link', { name: 'OpenStreetMap contributors' }),
    ).toBeVisible();
  });

  test('standard footer stays hidden on mobile', async ({ page }, testInfo) => {
    useViewportScreenshot(testInfo);
    annotateFeature(testInfo, 'public.footer', [
      'Standard footer remains hidden on mobile.',
    ]);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/faq');

    await expect(page.locator('#tr-footer')).toBeHidden();
  });
});
