import {
  annotateFeature,
  captureSection,
  expect,
  test,
} from '../../support/fixtures.mts';
import {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { updateUserByUsername } from '../../support/db.mts';

test('after sharing, desktop and mobile profile actions open the author’s pending Experience', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.create', [
    'An author can view the submitted Experience from the profile action.',
  ]);

  const recipient = createUser();
  await registerViaApi(request, recipient);
  await updateUserByUsername(recipient.username, {
    $set: { public: true, description: 'A public profile for this test.' },
    $unset: { emailTemporary: 1, emailToken: 1 },
  });
  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  const profilePath = `/profile/${recipient.username}`;
  await page.goto(profilePath);
  const desktopActions = page.locator('.profile-actions');
  await desktopActions
    .getByRole('link', { name: 'Share your experience' })
    .click();
  await page.getByRole('checkbox', { name: 'Met in person' }).check();
  const next = page.getByRole('button', { name: 'Next section', exact: true });
  await next.click();
  await page.getByText('Yes', { exact: true }).click();
  await next.click();
  const feedback = 'We tried a new walking route together.';
  await page.getByRole('textbox', { name: /public feedback/i }).fill(feedback);
  await page
    .getByRole('button', { name: 'Save experience', exact: true })
    .click();
  await expect(page.getByText('Your experience has been saved.')).toBeVisible();
  await page.getByRole('link', { name: 'See their experiences' }).click();

  const viewDesktop = desktopActions.getByRole('link', {
    name: 'View your experience',
  });
  await expect(viewDesktop).toBeVisible();
  await captureSection(desktopActions, 'view-shared-experience-desktop');
  const href = await viewDesktop.getAttribute('href');
  expect(href).toMatch(new RegExp(`^${profilePath}/experiences#[a-f0-9]{24}$`));
  await viewDesktop.click();
  await expect(page).toHaveURL(url => url.pathname + url.hash === href);
  await expect(page.getByText(feedback)).toBeVisible();
  await expect(
    page.getByText(/your experience will become public/i),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${profilePath}/overview`);
  const mobileActions = page.locator('.navbar-fixed-top-below');
  const viewMobile = mobileActions.getByRole('link', {
    name: 'View your experience',
  });
  await expect(viewMobile).toHaveAttribute('href', href!);
  await captureSection(mobileActions, 'view-shared-experience-mobile');
  await viewMobile.click();
  await expect(page.getByText(feedback)).toBeVisible();
});
