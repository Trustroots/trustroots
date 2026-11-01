import {
  annotateFeature,
  expect,
  expectPresent,
  test,
} from '../../support/fixtures.mts';

for (const language of ['en', 'ar']) {
  test(`homepage circle cards do not overlap the introduction in ${language}`, async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.home', ['Homepage loads for visitors.']);
    expectPresent(baseURL);
    await context.addCookies([{ name: 'i18n', value: language, url: baseURL }]);
    let count = 3;
    await page.route('**/api/tribes?*', route =>
      route.fulfill({
        json: Array.from({ length: count }, (_, index) => ({
          _id: `sample-${index}`,
          slug: `sample-${index}`,
          label: `Sample circle ${index}`,
        })),
      }),
    );

    for (count = 1; count <= 3; count++) {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        language === 'ar' ? 'rtl' : 'ltr',
      );
      const cards = page.locator('.home-circle-card');
      await expect(cards).toHaveCount(count);
      for (const width of [375, 768, 992, 1200]) {
        await page.setViewportSize({ width, height: 900 });
        const intro = await page.locator('.tribe-intro').boundingBox();
        expectPresent(intro);
        if (width === 375) {
          await expect(cards.first()).toBeHidden();
          await expect(page.locator('.tribes-xs a')).toHaveCount(count);
          const bubbles = await page.locator('.tribes-xs').boundingBox();
          expectPresent(bubbles);
          expect(bubbles.y).toBeGreaterThanOrEqual(intro.y + intro.height);
          continue;
        }
        const bounds = [intro];
        for (const card of await cards.all()) {
          const box = await card.boundingBox();
          expectPresent(box);
          for (const other of bounds) {
            expect(
              box.x + box.width <= other.x ||
                other.x + other.width <= box.x ||
                box.y + box.height <= other.y ||
                other.y + other.height <= box.y,
            ).toBe(true);
          }
          bounds.push(box);
        }
      }
    }
  });
}

test('homepage keeps circle landing links and photo credits in React', async ({
  page,
}) => {
  for (const query of ['circle=cyclists', 'tribe=cyclists']) {
    await page.goto(`/?${query}`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Join Trustroots now', exact: true }),
    ).toHaveAttribute('href', '/signup?tribe=cyclists');
    await expect(page.locator('.boards-credits')).toContainText('Photo');
  }
  await page
    .getByRole('link', { name: 'Join Trustroots now', exact: true })
    .click();
  await expect(page).toHaveURL(/\/signup\?tribe=cyclists$/);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
});

test('about redirects to the homepage and the information page uses React', async ({
  page,
}) => {
  await page.goto('/about');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await page.goto('/safety');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Safety Tips for Trustroots' }),
  ).toBeVisible();
});
