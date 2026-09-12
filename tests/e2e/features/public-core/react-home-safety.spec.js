const { expect, test } = require('../../support/test');

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
