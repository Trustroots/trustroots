import {
  annotateFeature,
  captureSection,
  expect,
  test,
} from '../../support/fixtures.mts';
import type { APIRequestContext, Page } from '@playwright/test';
import {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { updateUserByUsername } from '../../support/db.mts';

async function openNegativeExperience(page: Page, request: APIRequestContext) {
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
  return { recipient, next };
}

test('members can describe an experience they would not recommend without reporting', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.create', [
    'A negative recommendation can include public feedback independently of a private report.',
  ]);

  const { next } = await openNegativeExperience(page, request);
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

test('members can submit a separate private report with a negative experience', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.create', [
    'A private report accompanying an experience is sent separately to Support.',
  ]);

  const { recipient, next } = await openNegativeExperience(page, request);
  const privateReport = 'A private message from an example member.';
  const publicFeedback = 'The visit did not go as planned.';
  await page
    .getByRole('checkbox', {
      name: 'Privately report this person to the moderators',
    })
    .check();
  await page
    .getByRole('textbox', { name: 'Message to the moderators' })
    .fill(privateReport);
  await next.click();
  await page
    .getByRole('textbox', { name: /public feedback/i })
    .fill(publicFeedback);

  const experience = page.waitForResponse(
    response =>
      response.url().endsWith('/api/experiences') &&
      response.request().method() === 'POST',
  );
  const report = page.waitForResponse(
    response =>
      response.url().endsWith('/api/support') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Save experience', exact: true })
    .click();

  const savedExperience = await experience;
  expect(savedExperience.status()).toBe(201);
  expect(savedExperience.request().postDataJSON()).toMatchObject({
    recommend: 'no',
    feedbackPublic: publicFeedback,
  });
  expect(savedExperience.request().postData()).not.toContain(privateReport);
  const savedReport = await report;
  expect(savedReport.status()).toBe(200);
  expect(savedReport.request().postDataJSON()).toEqual({
    reportMember: recipient.username,
    message: privateReport,
  });
  await expect(page.getByText(/You also reported them to us/)).toBeVisible();
});
