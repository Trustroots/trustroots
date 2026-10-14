import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { updateUserByUsername } from '../../support/db.mts';
import type { APIRequestContext } from '@playwright/test';

async function createPublicUser(
  request: APIRequestContext,
): Promise<ReturnType<typeof createUser>> {
  const user = createUser();
  // Retained reviews and retries need distinct anonymous display names.
  user.firstName = 'Anonymous';
  user.lastName = user.username;
  await registerViaApi(request, user);
  await updateUserByUsername(user.username, {
    $set: {
      public: true,
      description: 'An anonymous profile description for Experience review.',
    },
    $unset: { emailTemporary: 1, emailToken: 1 },
  });
  return user;
}

test('support link lets an author request an edit and removal for admin review', async ({
  browser,
  baseURL,
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.change-requests', [
    'Admin generates a scoped support link.',
    'Author proposes an edit that stays pending until approval.',
    'Approved edit appears on the profile.',
    'Approved edit remains in admin search.',
    'Approved edit stays on the review page with profile links.',
    'Approved removal hides the Experience.',
    'Approved removal leaves the reciprocal Experience.',
  ]);

  const memberContext = await createIsolatedContext(browser, baseURL);
  const memberPage = await memberContext.newPage();

  try {
    const author = await createPublicUser(memberContext.request);
    const recipient = await createPublicUser(memberContext.request);
    const authorLabel = `${author.firstName} ${author.lastName}`;
    const recipientLabel = `${recipient.firstName} ${recipient.lastName}`;
    const supportSearch = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Create a support link' }),
    });
    const pendingRequest = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Pending requests' }) })
      .locator('.panel')
      .filter({ hasText: authorLabel });
    const approvedEdit = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Recently approved' }) })
      .locator('.panel')
      .filter({ hasText: authorLabel });
    const authorId = await fetchUserIdByUsername(
      memberContext.request,
      author.username,
    );
    const recipientId = await fetchUserIdByUsername(
      memberContext.request,
      recipient.username,
    );

    await signInViaApi(memberPage, memberContext.request, author);
    const created = await memberPage.request.post('/api/experiences', {
      data: {
        userTo: recipientId,
        interactions: { met: true, guest: false, host: false },
        recommend: 'yes',
        feedbackPublic: 'An anonymous original Experience.',
      },
    });
    expect(created.status()).toBe(201);
    const experience = await created.json();

    await signInViaApi(memberPage, memberContext.request, recipient);
    const reciprocal = await memberPage.request.post('/api/experiences', {
      data: {
        userTo: authorId,
        interactions: { met: true, guest: false, host: false },
        recommend: 'yes',
        feedbackPublic: 'An anonymous reciprocal Experience.',
      },
    });
    expect(reciprocal.status()).toBe(201);

    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/experience-changes');
    await page.getByLabel('Member username').fill(author.username);
    await page.getByRole('button', { name: 'Find Experiences' }).click();
    await expect(
      supportSearch.getByText('An anonymous original Experience.'),
    ).toBeVisible();
    await supportSearch
      .locator('.panel')
      .filter({ hasText: 'An anonymous original Experience.' })
      .getByRole('button', { name: 'Copy link for author' })
      .click();
    const link = await page
      .getByLabel('Support link (expires in seven days)')
      .inputValue();
    expect(link).toContain(`experiences/${experience._id}/change?secret=`);

    await signInViaApi(memberPage, memberContext.request, author);
    await memberPage.goto(link);
    await expect(
      memberPage.getByRole('heading', { name: 'Propose an edit' }),
    ).toBeVisible();
    await memberPage
      .getByLabel('Written feedback')
      .fill('An anonymous revised Experience.');
    await memberPage.getByLabel('Recommendation').selectOption('no');
    await memberPage.getByRole('button', { name: 'Request edit' }).click();
    await expect(memberPage.getByRole('status')).toContainText(
      'awaiting admin review',
    );

    const pending = await memberPage.request.get(
      `/api/experiences/${experience._id}`,
    );
    expect((await pending.json()).feedbackPublic).toBe(
      'An anonymous original Experience.',
    );

    await page.reload();
    await expect(pendingRequest).toHaveCount(1);
    await expect(
      pendingRequest.getByText(`${authorLabel} wrote about ${recipientLabel}`),
    ).toBeVisible();
    await expect(
      pendingRequest.getByText('An anonymous revised Experience.'),
    ).toBeVisible();
    await pendingRequest.getByRole('button', { name: 'Approve' }).click();
    await memberPage.reload();
    await expect(memberPage.getByRole('status')).toContainText('approved');

    const edited = await memberPage.request.get(
      `/api/experiences/${experience._id}`,
    );
    expect((await edited.json()).feedbackPublic).toBe(
      'An anonymous revised Experience.',
    );

    await memberPage.goto(`/profile/${recipient.username}/experiences`);
    await expect(
      memberPage.getByText('An anonymous revised Experience.'),
    ).toBeVisible();
    await expect(
      memberPage.getByText('An anonymous reciprocal Experience.'),
    ).toBeVisible();
    await expect(
      memberPage.getByText('An anonymous original Experience.'),
    ).toHaveCount(0);

    await memberPage.goto(`/profile/${author.username}/experiences`);
    await expect(
      memberPage.getByText('An anonymous revised Experience.'),
    ).toBeVisible();
    await expect(
      memberPage.getByText('An anonymous reciprocal Experience.'),
    ).toBeVisible();

    await expect(pendingRequest).toHaveCount(0);
    await expect(
      approvedEdit.getByText('Approved', { exact: true }),
    ).toBeVisible();
    await expect(
      approvedEdit.locator(`a[href="/profile/${author.username}/experiences"]`),
    ).toBeVisible();
    await expect(
      approvedEdit.locator(
        `a[href="/profile/${recipient.username}/experiences"]`,
      ),
    ).toBeVisible();
    await page.getByLabel('Member username').fill(author.username);
    await page.getByRole('button', { name: 'Find Experiences' }).click();
    await expect(
      supportSearch.getByText('Feedback: An anonymous revised Experience.'),
    ).toBeVisible();

    await memberPage.goto(link);
    await memberPage.getByRole('button', { name: 'Request removal' }).click();
    await expect(memberPage.getByRole('status')).toContainText(
      'awaiting admin review',
    );
    await page.reload();
    await expect(pendingRequest).toHaveCount(1);
    await expect(pendingRequest.getByText('requests removal.')).toBeVisible();
    await pendingRequest.getByRole('button', { name: 'Approve' }).click();
    await memberPage.reload();
    await expect(memberPage.getByRole('status')).toContainText('approved');
    expect(
      (
        await memberPage.request.get(`/api/experiences/${experience._id}`)
      ).status(),
    ).toBe(404);

    await memberPage.goto(`/profile/${recipient.username}/experiences`);
    await expect(memberPage.getByText('No experiences yet.')).toBeVisible();
    await expect(
      memberPage.getByText('An anonymous revised Experience.'),
    ).toHaveCount(0);

    await memberPage.goto(`/profile/${author.username}/experiences`);
    await expect(
      memberPage.getByText('An anonymous reciprocal Experience.'),
    ).toBeVisible();
    await expect(
      memberPage.getByText('An anonymous revised Experience.'),
    ).toHaveCount(0);

    await page.getByLabel('Member username').fill(author.username);
    await page.getByRole('button', { name: 'Find Experiences' }).click();
    await expect(
      supportSearch.getByText('An anonymous reciprocal Experience.'),
    ).toBeVisible();
    await expect(
      supportSearch.getByText('An anonymous revised Experience.'),
    ).toHaveCount(0);
    await expect(
      approvedEdit.getByText('Approved', { exact: true }),
    ).toBeVisible();
  } finally {
    await memberContext.close();
  }
});
