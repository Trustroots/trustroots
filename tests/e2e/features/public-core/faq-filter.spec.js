const { annotateFeature, expect, test } = require('../../support/test');

test('visitors can filter FAQ questions', async ({ page }, testInfo) => {
  annotateFeature(testInfo, 'public.faq-general', [
    'FAQ filter matches answer text and can be cleared.',
    'FAQ filter reports when no questions match.',
  ]);

  await page.goto('/faq');
  const filter = page.getByRole('searchbox', { name: 'Filter questions' });
  const matchingQuestion = page.locator(
    '#is-trustroots-exclusively-for-hitchhikers',
  );
  const otherQuestion = page.locator('#what-is-your-long-term-vision');

  await filter.fill('initially built');
  await expect(matchingQuestion).toBeVisible();
  await expect(otherQuestion).toBeHidden();

  await filter.fill('no such faq answer');
  await expect(
    page.getByText('No matching questions in this category.'),
  ).toBeVisible();

  await filter.fill('');
  await expect(matchingQuestion).toBeVisible();
  await expect(otherQuestion).toBeVisible();
});
