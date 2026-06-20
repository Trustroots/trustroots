const { annotateFeature, expect, test } = require('../../support/test');

const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');

test.describe('admin newsletter API feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('newsletter page handles disabled download endpoints', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Unavailable download actions degrade safely because subscriber APIs are disabled.',
    ]);

    await page.goto('/admin/newsletter');
    const disabledApi = await page.request.get(
      '/api/admin/newsletter-subscribers',
    );
    expect(disabledApi.status()).toBe(404);
  });
});
