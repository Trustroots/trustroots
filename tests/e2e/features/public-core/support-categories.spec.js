const {
  annotateFeature,
  test,
  expect,
  useElementScreenshot,
} = require('../../support/test');
const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');
const { withE2eDb } = require('../../support/db');
const {
  SUPPORT_CATEGORIES,
} = require('../../../../modules/support/shared/categories');

// Leave the form visible so the screenshots workflow captures each category's
// guidance, rather than only the confirmation shown by submission tests.
for (const [category, label] of Object.entries(SUPPORT_CATEGORIES)) {
  test(`support form displays ${label} guidance`, async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.support-page', [
      'Support contact form is visible.',
    ]);
    useElementScreenshot(testInfo, '.panel');
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`/support?category=${category}`);
    await expect(page.getByLabel('What can we help with?')).toHaveValue(
      category,
    );
    await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^send$/i })).toBeDisabled();
    if (category === 'volunteering') {
      await expect(
        page.getByText(
          'Briefly tell us about your interests, skills, and availability.',
        ),
      ).toBeVisible();
    } else if (category === 'reportMember') {
      await expect(
        page.getByText('Please include the member’s username in your message.'),
      ).toBeVisible();
      await expect(
        page.getByText(
          'This message goes to Trustroots support, not to the member.',
        ),
      ).toBeVisible();
    }
  });
}

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
  await expect(page.getByText('Thanks for getting in touch!')).toBeVisible();
  await expect(
    page.getByText(
      'Your message has been sent to the Trustroots team. We’re a small team of volunteers, so a reply may take a little time. We appreciate your patience.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/Trustroots Support Robot/)).toHaveCount(0);

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
  const categoryLabel = SUPPORT_CATEGORIES[category];
  expect(email.data.subject).toContain(`[${categoryLabel}]`);
  expect(email.data.text).toContain(`Category: ${categoryLabel}`);
  return stored;
}

for (const category of ['account', 'other']) {
  test(`visitor can send a support request in the ${category} category`, async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.support-submit', [
      'Support request submission succeeds with valid data.',
      category === 'account'
        ? 'Account help requests retain their category in storage and email.'
        : 'Other requests retain their category in storage and email.',
    ]);
    await page.goto('/support');
    await expect(page.getByLabel('What can we help with?')).toHaveValue(
      'other',
    );
    await page.getByLabel('What can we help with?').selectOption(category);
    await page
      .getByLabel('Email', { exact: true })
      .fill('visitor@example.test');
    const stored = await submitEnquiry(
      page,
      `Support enquiry ${category} ${Date.now()}`,
      category,
    );
    expect(stored.email).toBe('visitor@example.test');
    expect(stored.reportMember).toBeUndefined();
  });
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
