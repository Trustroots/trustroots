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

test('members can describe an experience they would not recommend without reporting', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.create', [
    'A negative recommendation can include public feedback independently of a private report.',
  ]);

  const recipient = createUser();
  await registerViaApi(request, recipient);
  await updateUserByUsername(recipient.username, {
    $set: { public: true, description: 'A public profile for this test.' },
    $unset: { emailTemporary: 1, emailToken: 1 },
  });
  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  await page.goto(`/profile/${recipient.username}/experiences/new`);
  await page.getByRole('checkbox', { name: 'Met in person' }).check();
  const next = page.getByRole('button', { name: 'Next section', exact: true });
  await next.click();

  await page.getByText('No', { exact: true }).click();
  await captureSection(
    page.locator('.panel').filter({
      has: page.getByRole('heading', { name: /would you recommend/i }),
    }),
    'experience-negative-recommendation',
  );
  await expect(page.getByText(/It’s okay to say no/)).toBeVisible();
  const report = page.getByRole('checkbox', {
    name: 'Privately report this person to the moderators',
  });
  await report.press('Space');
  await expect(report).toBeChecked();
  await report.press('Space');
  await expect(report).not.toBeChecked();
  await next.click();

  const feedbackPanel = page.getByRole('tabpanel', { name: 'Feedback' });
  await expect(feedbackPanel).toHaveCSS('opacity', '1');
  await captureSection(
    feedbackPanel.locator('.panel'),
    'experience-public-feedback-guidance',
  );
  await expect(
    page.getByText('Describe what happened and how it affected you.'),
  ).toBeVisible();
  await expect(page.getByText(/Leave out private details/)).toBeVisible();

  const feedback = 'I felt uncomfortable when our plans changed.';
  await page.getByRole('textbox', { name: /public feedback/i }).fill(feedback);
  const saved = page.waitForResponse(
    response =>
      response.url().endsWith('/api/experiences') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Save experience', exact: true })
    .click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toMatchObject({
    recommend: 'no',
    feedbackPublic: feedback,
  });
});
