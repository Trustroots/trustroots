const { annotateFeature, test, expect } = require('../../support/test');
const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');
const { withE2eDb } = require('../../support/db');

async function submitEnquiry(page, message, category) {
  await page.getByLabel('Message', { exact: true }).fill(message);
  const sent = page.waitForResponse(
    response =>
      response.url().includes('/api/support') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^send$/i }).click();
  const response = await sent;
  expect(response.ok()).toBeTruthy();
  expect(response.request().postDataJSON().category).toBe(category);
  await expect(page.getByText('Thank you!')).toBeVisible();

  const stored = await withE2eDb(db =>
    db.collection('supportrequests').findOne({ message }),
  );
  expect(stored.category).toBe(category);
  const email = await withE2eDb(db =>
    db.collection('agendaJobs').findOne({
      name: 'send email',
      'data.text': { $regex: message },
    }),
  );
  expect(email.data.subject).toContain(
    `[${category === 'volunteering' ? 'Volunteering' : 'Report a member'}]`,
  );
  expect(email.data.text).toContain(
    `Category: ${
      category === 'volunteering' ? 'Volunteering' : 'Report a member'
    }`,
  );
  return stored;
}

for (const signedIn of [false, true]) {
  test(`${
    signedIn ? 'member' : 'visitor'
  } can send a volunteer enquiry from the volunteering page`, async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.volunteering', [
      'Volunteering page loads.',
      signedIn
        ? 'Members can submit a volunteer enquiry from the volunteering page.'
        : 'Visitors can submit a volunteer enquiry from the volunteering page.',
    ]);
    annotateFeature(testInfo, 'public.support-submit', [
      'Support request submission succeeds with valid data.',
    ]);
    if (signedIn) {
      await signInViaApi(page, null, SEEDED_MEMBERS[0]);
    }
    await page.goto('/volunteering');
    await expect(
      page.getByRole('link', { name: 'Team Guide' }),
    ).toHaveAttribute('href', 'https://team.trustroots.org/');
    await page.getByRole('link', { name: 'I’d like to volunteer' }).click();
    await expect(page).toHaveURL(/\/support\?category=volunteering$/);
    await expect(page.getByLabel('What can we help with?')).toHaveValue(
      'volunteering',
    );
    await expect(
      page.getByText(
        /Briefly tell us about your interests, skills, and availability/,
      ),
    ).toBeVisible();
    if (!signedIn) {
      await page
        .getByLabel('Email', { exact: true })
        .fill('volunteer@example.test');
    }
    const message = `Volunteer enquiry ${
      signedIn ? 'member' : 'visitor'
    } ${Date.now()}`;
    const stored = await submitEnquiry(page, message, 'volunteering');
    expect(stored.email).toBe(
      signedIn ? SEEDED_MEMBERS[0].email : 'volunteer@example.test',
    );
    expect(Boolean(stored.user)).toBe(signedIn);
    expect(stored.reportMember).toBeUndefined();
  });
}

test('report links select reporting and retain the reported username', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.support-page', [
    'Support page accepts the report query parameter.',
    'Support contact form is visible.',
  ]);
  await page.goto('/support?report=example-member&category=volunteering');
  await expect(page.getByLabel('What can we help with?')).toHaveValue(
    'reportMember',
  );
  await expect(page.getByText('example-member', { exact: true })).toBeVisible();
  const stored = await submitEnquiry(
    page,
    `Member report ${Date.now()}`,
    'reportMember',
  );
  expect(stored.reportMember).toBe('example-member');
});

test('changing a report to volunteering omits the reported username', async ({
  page,
}) => {
  await page.goto('/support?report=example-member');
  await page.getByLabel('What can we help with?').selectOption('volunteering');
  await expect(page.getByText('example-member', { exact: true })).toBeHidden();
  const stored = await submitEnquiry(
    page,
    `Changed enquiry ${Date.now()}`,
    'volunteering',
  );
  expect(stored.reportMember).toBeUndefined();
});
