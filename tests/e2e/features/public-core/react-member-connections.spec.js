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
  for (const path of [
    '/contact-add/665000000000000000000090',
    '/profile/samplemember/experiences/new',
  ]) {
    await page.goto(path);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/signin');
    expect(url.searchParams.get('continue')).toBe('true');
    expect(url.searchParams.get('returnTo')).toBe(path);
  }
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

test('member shares an experience through React and returns to their profile history', async ({
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
    await expect(page.locator('#tr-react-root')).toBeVisible();
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

test('member recovers when an experience saves but its response is lost', async ({
  page,
  request,
}) => {
  const sender = await publicMember(request);
  const recipient = await publicMember(request);
  try {
    await signInViaApi(page, request, sender);
    await page.goto(`/profile/${recipient.username}/experiences/new`);
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
      .fill('A fictional experience with a lost response.');
    await page.route(
      '**/api/experiences',
      async route => {
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        await route.fulfill({
          status: 503,
          json: { message: 'Response unavailable' },
        });
      },
      { times: 1 },
    );
    const finish = page.getByRole('button', {
      name: 'Finish editing and save',
      exact: true,
    });
    await finish.click();
    await expect(page.getByRole('alert')).toHaveText(
      'We could not save your experience. Your text is still here. Please try again.',
    );
    await finish.click();
    await expect(
      page.getByText('Thank you for sharing your experience!'),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('You already shared your experience with them'),
    ).toBeVisible();
  } finally {
    await removeExperiencesBetweenUsernames(
      sender.username,
      recipient.username,
    );
  }
});

test('member retries failed experience requests without losing their feedback', async ({
  page,
  request,
}) => {
  const sender = await publicMember(request);
  const recipient = await publicMember(request);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await signInViaApi(page, request, sender);
    await page.route(
      '**/api/my-experience?**',
      route =>
        route.fulfill({ status: 503, json: { message: 'Temporary failure' } }),
      { times: 1 },
    );
    await page.goto(`/profile/${recipient.username}/experiences/new`);
    await expect(page.getByRole('alert')).toHaveText(
      /We could not load the experience form. Please try again./,
    );
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByLabel('Met in person', { exact: true }).check();
    await page
      .getByRole('button', { name: 'Next section', exact: true })
      .click();
    await page.locator('label').filter({ hasText: /^Yes$/ }).click();
    await page
      .getByRole('button', { name: 'Next section', exact: true })
      .click();
    const feedback = page.locator('#feedback-message');
    const finish = page.getByRole('button', {
      name: 'Finish editing and save',
      exact: true,
    });
    await feedback.fill('A fictional experience to preserve while retrying.');
    await page.route(
      '**/api/experiences',
      route =>
        route.fulfill({ status: 503, json: { message: 'Temporary failure' } }),
      { times: 1 },
    );
    await finish.click();
    await expect(page.getByRole('alert')).toHaveText(
      'We could not save your experience. Your text is still here. Please try again.',
    );
    await expect(feedback).toHaveValue(
      'A fictional experience to preserve while retrying.',
    );
    await expect(finish).toBeEnabled();

    await feedback.fill('x'.repeat(2001));
    await finish.click();
    await expect(page.getByRole('alert')).toHaveText(
      'Your feedback is too long. Please shorten it and try again.',
    );
    await expect(feedback).toHaveValue('x'.repeat(2001));
    await feedback.fill('We enjoyed a friendly conversation.');
    await finish.click();
    await expect(
      page.getByText('Thank you for sharing your experience!'),
    ).toBeVisible();
    await expect(
      page.getByText('We could not save your experience.', { exact: false }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByText('You already shared your experience with them'),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await removeExperiencesBetweenUsernames(
      sender.username,
      recipient.username,
    );
  }
});
