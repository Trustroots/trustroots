const { annotateFeature, expect, test } = require('../../support/fixtures');

test('visitors can filter FAQ questions', async ({ page }, testInfo) => {
  annotateFeature(testInfo, 'public.faq-general', [
    'FAQ filter matches answer text across categories and can be cleared.',
    'FAQ filter reports when no questions match.',
  ]);

  await page.goto('/faq');
  const filter = page.getByRole('searchbox', {
    name: 'Search all frequently asked questions',
  });
  const matchingQuestion = page.locator(
    '#is-trustroots-exclusively-for-hitchhikers',
  );
  const otherQuestion = page.locator('#what-is-your-long-term-vision');

  await filter.fill('initially built');
  await expect(matchingQuestion).toBeVisible();
  await expect(otherQuestion).toBeHidden();

  await filter.fill('no such faq answer');
  await expect(page.getByText('No questions match your search.')).toBeVisible();

  await filter.fill('');
  await expect(matchingQuestion).toBeVisible();
  await expect(otherQuestion).toBeVisible();

  await filter.fill('F-Droid');
  await expect(page.getByRole('region', { name: 'Technology' })).toBeVisible();
  await expect(page.locator('#f-droid')).toBeVisible();
  await expect(otherQuestion).toBeHidden();
  await filter.fill('');
  await expect(otherQuestion).toBeVisible();
  await expect(page.locator('#f-droid')).toBeHidden();

  await page.goto('/faq/technology');
  await page
    .getByRole('searchbox', { name: 'Search all frequently asked questions' })
    .fill('hitchhikers');
  await expect(
    page.getByRole('region', { name: 'Site & community' }),
  ).toBeVisible();
  await expect(
    page.locator('#is-trustroots-exclusively-for-hitchhikers'),
  ).toBeVisible();
});
