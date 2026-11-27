import {
  annotateFeature,
  expect,
  expectPresent,
  test,
} from '../../support/fixtures.mts';
import { removeUserByUsername, withE2eDb } from '../../support/db.mts';
import {
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';

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
  await expect(
    page.getByRole('heading', {
      name: 'Protect Your Identity and Payment Details',
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Asking for payment breaks our community rules. Never share credit card details with other members. We discourage hosts and guests from requesting ID or passports. If you agree to a check, do it in person and avoid making or keeping digital copies.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('An ID request alone does not break our community rules.'),
  ).toBeVisible();
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Safety Tips for Trustroots' }),
  ).toBeVisible();
});

test('a signed-in safety page visit persists across browser sessions', async ({
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'public.safety', [
    'A signed-in member’s safety page visit persists across sessions.',
  ]);
  const member = createUser();
  const readVisit = () =>
    withE2eDb(async db => {
      const user = await db
        .collection('users')
        .findOne(
          { username: member.username },
          { projection: { safetyPageVisited: 1 } },
        );
      return user?.safetyPageVisited;
    });

  const firstSession = await createIsolatedContext(browser, baseURL);
  try {
    try {
      await registerViaApi(firstSession.request, member);
      expect(await readVisit()).toBeUndefined();
      const page = await firstSession.newPage();
      await page.goto('/safety');
      await expect(
        page.getByRole('heading', { name: 'Safety Tips for Trustroots' }),
      ).toBeVisible();
      await expect.poll(readVisit).toBe(true);
    } finally {
      await firstSession.close();
    }

    const secondSession = await createIsolatedContext(browser, baseURL);
    try {
      const page = await secondSession.newPage();
      await signInViaApi(page, undefined, member);
      expect(await readVisit()).toBe(true);

      const visit = page.waitForResponse(
        response =>
          response.url().endsWith('/api/users/me/safety-visit') &&
          response.request().method() === 'PUT',
      );
      await page.goto('/safety');
      expect((await visit).status()).toBe(204);
      expect(await readVisit()).toBe(true);
    } finally {
      await secondSession.close();
    }
  } finally {
    await removeUserByUsername(member.username);
  }
});
