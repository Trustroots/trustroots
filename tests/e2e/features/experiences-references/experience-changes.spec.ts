import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import {
  updateUserByUsername,
  withE2eDb,
  objectId,
} from '../../support/db.mts';
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

for (const reviewerRole of ['admin', 'support-team']) {
  test(`support link lets an author request an edit and removal for ${reviewerRole} review`, async ({
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
        .filter({
          has: page.getByRole('heading', { name: 'Pending requests' }),
        })
        .locator('.panel')
        .filter({ hasText: authorLabel });
      const approvedEdit = page
        .locator('section')
        .filter({
          has: page.getByRole('heading', { name: 'Recently approved' }),
        })
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

      const reviewer =
        reviewerRole === 'admin'
          ? SEEDED_ADMIN
          : await createPublicUser(request);
      if (reviewerRole === 'support-team') {
        await updateUserByUsername(reviewer.username, {
          $set: { roles: ['user', 'support-team'] },
        });
      }
      await signInViaApi(page, request, reviewer);
      await page.goto('/admin/experience-changes');
      await expect(
        page.getByRole('link', { name: 'Experience changes', exact: true }),
      ).toBeVisible();
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

      if (reviewerRole === 'support-team') {
        const queue = await (
          await page.request.get('/api/admin/experience-change-requests')
        ).json();
        const pendingRequest = queue.find(
          (item: { status: string }) => item.status === 'pending',
        );
        const decisionPath = `/api/admin/experience-change-requests/${pendingRequest._id}/decision`;
        const ownApproval = await page.request.post(decisionPath, {
          data: { decision: 'approve' },
        });
        expect(ownApproval.status()).toBe(403);
        await page.reload();
        await expect(
          page.getByRole('button', { name: 'Approve', exact: true }),
        ).toBeDisabled();
        await expect(
          page.getByText(
            'Approval requires another support team member or an administrator.',
          ),
        ).toBeVisible();
        const peer = await createPublicUser(request);
        await updateUserByUsername(peer.username, {
          $set: { roles: ['user', 'support-team'] },
        });
        await signInViaApi(page, request, peer);
      }

      await page.reload();
      await expect(pendingRequest).toHaveCount(1);
      await expect(
        pendingRequest.getByText(
          `${authorLabel} wrote about ${recipientLabel}`,
        ),
      ).toBeVisible();
      await expect(
        pendingRequest.getByText('An anonymous revised Experience.'),
      ).toBeVisible();
      await expect(
        pendingRequest.getByRole('heading', { name: 'Original values' }),
      ).toBeVisible();
      // Recover the persisted state left by an interruption after applying an edit.
      await withE2eDb(async db => {
        const change = await db
          .collection('experiencechangerequests')
          .findOne({ experience: objectId(experience._id), active: true });
        const reviewer = await db
          .collection('users')
          .findOne({ username: SEEDED_ADMIN.username });
        if (!change || !reviewer) throw new Error('Missing review fixture');
        await db.collection('experiencechangerequests').updateOne(
          { _id: change._id },
          {
            $set: {
              status: 'processing',
              reviewedAt: new Date(),
              reviewedBy: reviewer._id,
            },
          },
        );
        await db.collection('experiences').updateOne(
          { _id: objectId(experience._id) },
          {
            $set: change.proposed,
            $addToSet: { appliedChangeRequests: change._id },
          },
        );
      });
      await page.reload();
      await expect(
        pendingRequest.getByText(
          'Feedback: An anonymous original Experience.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        pendingRequest.getByRole('button', { name: 'Reject' }),
      ).toBeDisabled();
      await memberPage.reload();
      await expect(memberPage.getByRole('status')).toContainText(
        'being approved',
      );
      await pendingRequest
        .getByRole('button', { name: 'Finish approval' })
        .click();
      await expect(pendingRequest).toHaveCount(0);
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
        approvedEdit.locator(
          `a[href="/profile/${author.username}/experiences"]`,
        ),
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
}

test('support member cannot change an Experience on their own profile', async ({
  browser,
  baseURL,
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.change-requests', [
    'Support member cannot change an Experience on their own profile.',
  ]);

  const memberContext = await createIsolatedContext(browser, baseURL);
  const memberPage = await memberContext.newPage();
  const ownProfile =
    'Support members cannot change Experiences on their own profile.';

  try {
    const author = await createPublicUser(memberContext.request);
    const recipient = await createPublicUser(memberContext.request);
    await updateUserByUsername(author.username, {
      $set: { roles: ['user', 'support-team'] },
    });
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
        feedbackPublic: 'An anonymous own-profile Experience.',
      },
    });
    expect(created.status()).toBe(201);

    await signInViaApi(page, request, author);
    await page.goto('/admin/experience-changes');
    await page.getByLabel('Member username').fill(author.username);
    await page.getByRole('button', { name: 'Find Experiences' }).click();
    const ownExperience = page.locator('.panel').filter({
      hasText: 'An anonymous own-profile Experience.',
    });
    await expect(ownExperience.getByText(ownProfile)).toBeVisible();
    await expect(
      ownExperience.getByRole('button', { name: 'Copy link for author' }),
    ).toBeDisabled();
    await expect(
      ownExperience.getByRole('button', {
        name: 'Copy link for profile owner',
      }),
    ).toBeDisabled();

    const peer = await createPublicUser(request);
    await updateUserByUsername(peer.username, {
      $set: { roles: ['user', 'support-team'] },
    });
    await signInViaApi(page, request, peer);
    await page.goto('/admin/experience-changes');
    await page.getByLabel('Member username').fill(author.username);
    await page.getByRole('button', { name: 'Find Experiences' }).click();
    await page
      .locator('.panel')
      .filter({ hasText: 'An anonymous own-profile Experience.' })
      .getByRole('button', { name: 'Copy link for author' })
      .click();
    const link = await page
      .getByLabel('Support link (expires in seven days)')
      .inputValue();

    await memberPage.goto(link);
    await memberPage
      .getByLabel('Written feedback')
      .fill('An anonymous own-profile revision.');
    await memberPage.getByLabel('Recommendation').selectOption('no');
    await memberPage.getByRole('button', { name: 'Request edit' }).click();
    await expect(memberPage.getByRole('status')).toContainText(
      'awaiting admin review',
    );

    await signInViaApi(page, request, author);
    await page.goto('/admin/experience-changes');
    const pendingRequest = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Pending requests' }) })
      .locator('.panel')
      .filter({ hasText: `${author.firstName} ${author.lastName}` });
    await expect(pendingRequest.getByText(ownProfile)).toBeVisible();
    await expect(
      pendingRequest.getByRole('button', { name: 'Approve' }),
    ).toBeDisabled();
    await expect(
      pendingRequest.getByRole('button', { name: 'Reject' }),
    ).toBeDisabled();

    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/experience-changes');
    await pendingRequest.getByRole('button', { name: 'Approve' }).click();
    await memberPage.reload();
    await expect(memberPage.getByRole('status')).toContainText('approved');
  } finally {
    await memberContext.close();
  }
});
