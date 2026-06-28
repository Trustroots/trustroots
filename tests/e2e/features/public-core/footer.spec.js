const {
  annotateFeature,
  expect,
  test,
  useElementScreenshot,
  useViewportScreenshot,
} = require('../../support/test');

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

    await page.goto('/faq');

    const footer = page.locator('#tr-footer');
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();

    for (const [name, href] of [
      ['Volunteering', '/volunteering'],
      ['Rules', '/rules'],
      ['FAQ', '/faq'],
      ['Privacy', '/privacy'],
      ['Contact', '/contact'],
    ]) {
      await expect(footer.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
    }

    await expect(footer.getByRole('link', { name: 'Contribute' })).toHaveCount(
      0,
    );
    await expect(
      footer.getByRole('link', { name: 'Trustroots Foundation' }),
    ).toHaveCount(0);
    await expect(footer.locator('.icon-github')).toHaveCount(1);
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
    expect(metaBox).not.toBeNull();
    expect(metaBox.x + metaBox.width).toBeGreaterThan(
      contentBox.x + contentBox.width - 1,
    );
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
