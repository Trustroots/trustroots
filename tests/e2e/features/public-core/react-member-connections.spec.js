const { expect, test } = require('../../support/test');
const {
  createUser,
  registerViaApi,
  signInViaApi,
  fetchUserIdByUsername,
  SEEDED_RELATIONSHIP_MEMBERS,
} = require('../../support/helpers');
const {
  removeExperiencesBetweenUsernames,
  updateUserByUsername,
} = require('../../support/db');

async function publicMember(request) {
  const user = createUser();
  await registerViaApi(request, user);
  await updateUserByUsername(user.username, {
    $set: {
      public: true,
      description:
        'A fictional member profile used for browser workflow checks.',
    },
    $unset: { emailTemporary: 1, emailToken: 1 },
  });
  return user;
}

test('connection routes require sign-in and reject self-connections', async ({
  page,
}) => {
  await page.goto('/contact-add/665000000000000000000090');
  await expect(page).toHaveURL(/\/signin$/);
  await page.goto('/profile/samplemember/experiences/new');
  await expect(page).toHaveURL(/\/signin$/);
  const member = SEEDED_RELATIONSHIP_MEMBERS.alice;
  await signInViaApi(page, undefined, member);
  await page.goto(`/contact-add/${member.id}`);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(
    page.getByText('You cannot connect with yourself. That is just silly!'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add contact' })).toHaveCount(
    0,
  );
});

test('member edits and submits a contact request and sees its pending state', async ({
  page,
  request,
}) => {
  const sender = await publicMember(request);
  const recipient = await publicMember(request);
  const recipientId = await fetchUserIdByUsername(request, recipient.username);
  await signInViaApi(page, request, sender);
  await page.goto(`/contact-add/${recipientId}`);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  const editor = page.locator('.contact-message [contenteditable="true"]');
  await editor.fill('A friendly sample invitation.');
  const sent = page.waitForResponse(
    response =>
      response.url().endsWith('/api/contact') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  const response = await sent;
  expect(response.ok()).toBeTruthy();
  expect(response.request().postDataJSON().message).toContain(
    'A friendly sample invitation.',
  );
  await expect(
    page.getByText(/Done! We sent an email to your contact/),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Connection already initiated; now it has to be confirmed.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add contact' })).toHaveCount(
    0,
  );
});

test('member shares an experience through React and returns to Angular history', async ({
  page,
  request,
}) => {
  const sender = await publicMember(request);
  const recipient = await publicMember(request);
  try {
    await signInViaApi(page, request, sender);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/profile/${recipient.username}/experiences/new`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Next section', exact: true }),
    ).toBeDisabled();
    await page.getByLabel('Met in person', { exact: true }).check();
    await page
      .getByRole('button', { name: 'Next section', exact: true })
      .click();
    await page.locator('label').filter({ hasText: /^Yes$/ }).click();
    await page
      .getByRole('button', { name: 'Next section', exact: true })
      .click();
    await page
      .locator('#feedback-message')
      .fill('We enjoyed a friendly conversation.');
    await page
      .getByRole('button', { name: 'Finish editing and save', exact: true })
      .click();
    await expect(
      page.getByText('Thank you for sharing your experience!'),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('You already shared your experience with them'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'See their experiences' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/profile/${recipient.username}/experiences$`),
    );
    await expect(page.locator('#tr-react-root')).toHaveCount(0);
    await expect(page.locator('[data-ui-view]')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    // Keep the shared public-project database seed counts stable for
    // seeded-content.spec.js statistics assertions that run later.
    await removeExperiencesBetweenUsernames(
      sender.username,
      recipient.username,
    );
  }
});
