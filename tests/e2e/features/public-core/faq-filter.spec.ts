import { annotateFeature, expect, test } from '../../support/fixtures.mts';

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

test('visitors can find getting-started guidance in the FAQ', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.faq-get-started', [
    'Visitors can open Get Started and find all four wiki guides.',
    'FAQ search can find a Get Started answer from another category.',
  ]);

  await page.goto('/faq');
  const filter = page.getByRole('searchbox', {
    name: 'Search all frequently asked questions',
  });
  const gettingStarted = page.getByRole('region', { name: 'Get Started' });

  await filter.fill('organised ways to host travellers');
  await expect(
    gettingStarted.getByRole('heading', { name: 'What is Hospex?' }),
  ).toBeVisible();
  await expect(
    gettingStarted.getByRole('heading', { name: 'How does Trustroots work?' }),
  ).toBeHidden();
  await filter.clear();
  await expect(gettingStarted).toBeHidden();

  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/faq\/get-started$/);
  await expect(page).toHaveTitle(/FAQ - Get Started/);

  const wikiLinks = [
    ['Read the Trustroots starter guide', 'Start_Rooting'],
    ['Read how to create a good profile', 'How_To_Create_A_Good_Profile'],
    ['Read the safety guide', 'Safety'],
    [
      'Read a brief history of hospitality exchange networks',
      'A_brief_history_of_hospitality_exchange_networks',
    ],
  ];
  for (const [name, article] of wikiLinks) {
    const link = gettingStarted.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      'href',
      `https://wiki.trustroots.org/en/${article}`,
    );
  }

  await page.getByRole('link', { name: 'How can I stay safe?' }).click();
  await expect(page).toHaveURL(/\/faq\/get-started#how-can-i-stay-safe$/);
  await expect(gettingStarted.locator('#how-can-i-stay-safe')).toBeInViewport();
});
