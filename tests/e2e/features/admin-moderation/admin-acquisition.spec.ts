import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import type { ObjectId } from 'mongodb';

import {
  SEEDED_ADMIN,
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { findActionToken, withE2eDb } from '../../support/db.mts';

interface AcquisitionMatch {
  username: string;
  restrictionStatuses: string[];
  roles?: string[];
  matchReasons?: string[];
}

interface AcquisitionStory {
  _id: string;
  username: string;
  restrictionStatuses: string[];
  restrictedMatches: AcquisitionMatch[];
  acquisitionStory: string;
  circleCount: number;
  locationLiving: string;
  locationFrom: string;
  hostingLocation: number[];
  public: boolean;
}

test.describe('admin acquisition feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('support opens ordinary profiles from the welcoming list', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories');
    const support = createUser();
    const member = createUser();
    const context = await createIsolatedContext(browser, baseURL);
    try {
      for (const user of [support, member]) {
        await registerViaApi(context.request, user);
      }
      await withE2eDb(async db => {
        await db
          .collection('users')
          .updateOne(
            { username: support.username },
            { $set: { roles: ['user', 'support-team'], public: true } },
          );
        await db.collection('users').updateOne(
          { username: member.username },
          {
            $set: {
              public: true,
              acquisitionStory: 'A fictional recommendation.',
            },
          },
        );
      });
      const page = await context.newPage();
      await signInViaApi(page, context.request, support);
      await page.goto('/admin/acquisition-stories');
      const memberLink = page.getByRole('link', {
        name: `${member.username} (${member.firstName} ${member.lastName})`,
        exact: true,
      });
      await expect(memberLink).toHaveAttribute(
        'href',
        `/profile/${member.username}`,
      );
      const noteRequests: string[] = [];
      page.on('request', request => {
        if (new URL(request.url()).pathname === '/api/admin/notes') {
          noteRequests.push(request.url());
        }
      });
      await memberLink.click();
      await expect(page).toHaveURL(`/profile/${member.username}`);
      await expect(
        page.getByRole('heading', {
          name: `${member.firstName} ${member.lastName}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator('.admin-notes')).toHaveCount(0);
      expect(noteRequests).toEqual([]);
    } finally {
      await context.close();
      await withE2eDb(db =>
        db.collection('users').deleteMany({
          username: { $in: [support.username, member.username] },
        }),
      );
    }
  });

  test('greeters see restriction badges without moderation access', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Greeters see suspended and shadowbanned statuses on members and restricted matches.',
      'Restriction visibility does not grant moderation access.',
    ]);
    const greeter = createUser();
    const member = createUser();
    const match = createUser();
    const context = await createIsolatedContext(browser, baseURL);
    try {
      for (const user of [greeter, member, match]) {
        await registerViaApi(context.request, user);
      }
      await withE2eDb(async db => {
        await db.collection('users').updateOne(
          { username: greeter.username },
          {
            $set: { roles: ['user', 'welcome-team'], public: true },
          },
        );
        await db.collection('users').updateOne(
          { username: member.username },
          {
            $set: {
              roles: ['user', 'suspended'],
              public: true,
              acquisitionStory: 'A fictional recommendation.',
              emailTemporary: `${match.username}@example.test`,
            },
          },
        );
        await db.collection('users').updateOne(
          { username: match.username },
          {
            $set: {
              roles: ['user', 'shadowban', 'volunteer'],
              acquisitionStory: '',
            },
          },
        );
      });
      const page = await context.newPage();
      await signInViaApi(page, context.request, greeter);
      const response = await context.request.post(
        '/api/admin/acquisition-stories',
        {
          headers: { 'X-Trustroots-Request': '1' },
        },
      );
      expect(response.ok()).toBeTruthy();
      const story = ((await response.json()) as AcquisitionStory[]).find(
        row => row.username === member.username,
      )!;
      expect(story.restrictionStatuses).toEqual(['suspended']);
      const restrictedMatch = story.restrictedMatches.find(
        row => row.username === match.username,
      )!;
      expect(restrictedMatch.restrictionStatuses).toEqual(['shadowban']);
      expect(restrictedMatch.roles).toBeUndefined();
      await page.goto('/admin/acquisition-stories');
      const row = page.locator('tbody tr').filter({
        has: page.locator(`a[href="/profile/${member.username}"]`),
      });
      await expect(row.getByText('Suspended', { exact: true })).toBeVisible();
      await expect(
        row.getByText('Shadowbanned', { exact: true }),
      ).toBeVisible();
      await expect(row.getByText('Visible', { exact: true })).toBeVisible();
      const denied = await context.request.post('/api/admin/user/change-role', {
        headers: { 'X-Trustroots-Request': '1' },
        data: { id: story._id, role: 'suspended', action: 'remove' },
      });
      expect(denied.status()).toBe(403);
    } finally {
      await withE2eDb(db =>
        db.collection('users').deleteMany({
          username: {
            $in: [greeter.username, member.username, match.username],
          },
        }),
      );
      await context.close();
    }
  });

  test('greeters can resend signup confirmation for unconfirmed acquisition stories', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Acquisition stories show whether signup email is confirmed.',
      'Greeters can replace an unconfirmed signup link with a fresh link.',
      'The old link is invalidated and the fresh link activates the account.',
      'Confirmed members have no resend action and regular members are denied.',
      'The acquisition story response contains no email addresses or tokens.',
    ]);

    const greeter = createUser();
    const member = createUser();
    const confirmed = createUser();
    const regular = createUser();
    const context = await createIsolatedContext(browser, baseURL);
    const regularContext = await createIsolatedContext(browser, baseURL);
    try {
      for (const user of [greeter, member, confirmed]) {
        await registerViaApi(context.request, user);
      }
      await registerViaApi(regularContext.request, regular);
      await withE2eDb(async db => {
        await db
          .collection('users')
          .updateOne(
            { username: greeter.username },
            { $set: { roles: ['user', 'welcome-team'], public: true } },
          );
        await db.collection('users').updateOne(
          { username: member.username },
          {
            $set: {
              acquisitionStory: 'A fictional referral.',
              public: false,
              emailTemporary: member.email,
            },
          },
        );
        await db.collection('users').updateOne(
          { username: confirmed.username },
          {
            $set: {
              acquisitionStory: 'A second fictional referral.',
              public: true,
            },
            $unset: {
              emailTemporary: '',
              emailToken: '',
              emailTokenExpires: '',
            },
          },
        );
      });
      const memberId = await withE2eDb(async db =>
        String(
          (await db.collection('users').findOne({ username: member.username }))!
            ._id,
        ),
      );
      await signInViaApi(await context.newPage(), context.request, greeter);
      const regularPage = await regularContext.newPage();
      await signInViaApi(regularPage, regularContext.request, regular);

      const listResponse = await context.request.post(
        '/api/admin/acquisition-stories',
        { headers: { 'X-Trustroots-Request': '1' } },
      );
      expect(listResponse.ok()).toBeTruthy();
      const stories = (await listResponse.json()) as Array<{
        _id: string;
        username: string;
        emailConfirmed: boolean;
        [key: string]: unknown;
      }>;
      const pendingStory = stories.find(
        story => story.username === member.username,
      )!;
      const confirmedStory = stories.find(
        story => story.username === confirmed.username,
      )!;
      expect(pendingStory.emailConfirmed).toBe(false);
      expect(confirmedStory.emailConfirmed).toBe(true);
      expect(JSON.stringify(stories)).not.toContain(member.email);
      expect(JSON.stringify(stories)).not.toContain(
        await findActionToken(member.username, 'emailToken'),
      );

      const page = await context.newPage();
      await page.goto('/admin/acquisition-stories');
      const pendingRow = page.locator('tbody tr').filter({
        has: page.locator(`a[href="/profile/${member.username}"]`),
      });
      const confirmedRow = page.locator('tbody tr').filter({
        has: page.locator(`a[href="/profile/${confirmed.username}"]`),
      });
      await expect(
        pendingRow.getByText('Not confirmed', { exact: true }),
      ).toBeVisible();
      await expect(
        confirmedRow.getByText('Confirmed', { exact: true }),
      ).toBeVisible();
      await expect(
        confirmedRow.getByRole('button', { name: 'Send confirmation' }),
      ).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath('acquisition-email-confirmation-status.png'),
        fullPage: true,
      });

      const originalToken = await findActionToken(
        member.username,
        'emailToken',
      );
      const originalEmail = member.email;
      await pendingRow
        .getByRole('button', { name: 'Send confirmation' })
        .click();
      await expect(pendingRow.getByRole('status')).toHaveText(
        'Sent confirmation email.',
      );
      const replacementToken = await findActionToken(
        member.username,
        'emailToken',
      );
      expect(replacementToken).not.toBe(originalToken);
      const resentMember = await withE2eDb(db =>
        db.collection('users').findOne({ username: member.username }),
      );
      expect(resentMember?.public).toBe(false);
      expect(resentMember?.emailTemporary).toBe(originalEmail);
      expect(resentMember?.emailTokenExpires).toBeInstanceOf(Date);
      const remainingTokenLifetime =
        resentMember!.emailTokenExpires!.getTime() - Date.now();
      expect(remainingTokenLifetime).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(remainingTokenLifetime).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      const oldLink = await context.request.post(
        `/api/auth/confirm-email/${originalToken}`,
        { headers: { 'X-Trustroots-Request': '1' } },
      );
      expect(oldLink.status()).toBe(400);
      const confirmedResend = await context.request.post(
        `/api/admin/acquisition-stories/${confirmedStory._id}/resend-confirmation`,
        { headers: { 'X-Trustroots-Request': '1' } },
      );
      expect(confirmedResend.status()).toBe(400);
      const newLink = await context.request.post(
        `/api/auth/confirm-email/${replacementToken}`,
        { headers: { 'X-Trustroots-Request': '1' } },
      );
      expect(newLink.ok()).toBeTruthy();

      const denied = await regularContext.request.post(
        `/api/admin/acquisition-stories/${memberId}/resend-confirmation`,
        { headers: { 'X-Trustroots-Request': '1' } },
      );
      expect(denied.status()).toBe(403);
    } finally {
      await withE2eDb(db =>
        db.collection('users').deleteMany({
          username: {
            $in: [
              greeter.username,
              member.username,
              confirmed.username,
              regular.username,
            ],
          },
        }),
      );
      await context.close();
      await regularContext.close();
    }
  });

  test('admin can filter acquisition stories to unassigned members', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Unassigned only hides assigned members and restores them when cleared.',
      'Filtering preserves the selected sort order and handles empty results.',
    ]);
    const assigned = {
      _id: '111111111111111111111111',
      username: 'forest-member',
      public: true,
      created: '2026-01-01T00:00:00.000Z',
      welcomer: {
        _id: '222222222222222222222222',
        username: 'fictional-greeter',
        created: '2026-01-02T00:00:00.000Z',
      },
    };
    let stories = [
      assigned,
      {
        _id: '333333333333333333333333',
        username: 'brook-member',
        public: false,
        created: '2026-01-03T00:00:00.000Z',
        welcomer: null,
      },
      {
        _id: '444444444444444444444444',
        username: 'river-member',
        public: true,
        created: '2026-01-04T00:00:00.000Z',
      },
    ];
    let requests = 0;
    await page.route('**/api/admin/acquisition-stories', async route => {
      requests += 1;
      await route.fulfill({ contentType: 'application/json', json: stories });
    });

    await page.goto('/admin/acquisition-stories');
    const checkbox = page.getByRole('checkbox', { name: 'Unassigned only' });
    const visibility = page.getByRole('combobox', {
      name: 'Profile visibility',
    });
    const members = page.locator('tbody tr td:nth-child(2)');
    await expect(checkbox).not.toBeChecked();
    await expect(visibility).toHaveValue('all');
    await expect(
      page.getByText(
        'Hidden profiles have not activated their signup through email confirmation.',
      ),
    ).toBeVisible();
    await expect(members).toHaveCount(3);
    await page.getByRole('button', { name: 'Member', exact: true }).click();
    await checkbox.check();
    await expect(members).toHaveText(['brook-member', 'river-member']);
    await visibility.selectOption('visible');
    await expect(members).toHaveText(['river-member']);
    await visibility.selectOption('hidden');
    await expect(members).toHaveText(['brook-member']);
    await visibility.selectOption('all');
    await expect(members).toHaveText(['brook-member', 'river-member']);
    await expect(page.locator('tbody tr')).toContainText([
      'Unassigned',
      'Unassigned',
    ]);
    await page.getByRole('button', { name: 'Member ▲', exact: true }).click();
    await expect(members).toHaveText(['river-member', 'brook-member']);
    await checkbox.uncheck();
    await expect(members).toHaveText([
      'river-member',
      'forest-member',
      'brook-member',
    ]);
    expect(requests).toBe(1);

    stories = [assigned];
    await page.reload();
    await expect(members).toHaveCount(1);
    await checkbox.check();
    await expect(
      page.getByText('No unassigned acquisition stories found.'),
    ).toBeVisible();
    await expect(checkbox).toBeVisible();
    await expect(visibility).toBeVisible();
    await checkbox.uncheck();
    await expect(members).toHaveText(['forest-member']);
  });

  test('admin acquisition stories remain available without analysis', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Acquisition stories page loads.',
      'Acquisition stories query returns deterministic rows.',
      'Story rows link profile pictures to public member profiles.',
      'Story rows show circle participation.',
      'Story rows show available member and hosting locations.',
      'Story rows show whether profiles are visible.',
      'Story rows show matching restricted accounts.',
      'Story columns can be sorted.',
      'Acquisition stories remain available without Analysis navigation or API.',
    ]);

    await page.goto('/admin/acquisition-stories');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories/);
    await expect(
      page.getByRole('link', {
        name: 'Open public profile for Alice Contact',
      }),
    ).toHaveAttribute('href', '/profile/e2e-seeded-alice');
    await expect(
      page.getByRole('button', { name: /^circles$/i }),
    ).toBeVisible();
    await expect(page.getByText('Living: Fictional home')).toBeVisible();
    await expect(page.getByText('From: Fictional origin')).toBeVisible();
    await expect(page.getByText(/^Hosting: /)).toBeVisible();
    const aliceRow = page.locator('tr').filter({ hasText: 'Alice Contact' });
    await expect(aliceRow.getByText('Visible', { exact: true })).toBeVisible();
    await expect(
      aliceRow.getByRole('link', {
        name: 'e2e-seeded-shadow (Shadow Spammer)',
      }),
    ).toHaveAttribute('href', '/admin/user/e2e-seeded-shadow');
    await expect(
      aliceRow.getByText(/Temporary email identifier/),
    ).toBeVisible();
    await expect(aliceRow.getByText(/Acquisition story/)).toHaveCount(0);
    await expect(page.locator('img[loading="lazy"]').first()).toHaveAttribute(
      'src',
      /\/api\/users\/.+\/avatar\?size=32/,
    );

    const stories = await page.request.post('/api/admin/acquisition-stories', {
      headers: { 'X-Trustroots-Request': '1' },
    });
    expect(stories.ok()).toBeTruthy();
    const storyRows = (await stories.json()) as AcquisitionStory[];
    const aliceStory = storyRows.find(item =>
      /hitchhiking friends/i.test(item.acquisitionStory),
    )!;
    expect(aliceStory).toBeTruthy();
    expect(aliceStory.circleCount).toBe(1);
    expect(aliceStory.locationLiving).toBe('Fictional home');
    expect(aliceStory.locationFrom).toBe('Fictional origin');
    expect(aliceStory.hostingLocation).toHaveLength(2);
    expect(aliceStory.public).toBe(true);
    expect(aliceStory.restrictedMatches).toEqual([
      expect.objectContaining({
        username: 'e2e-seeded-shadow',
        matchReasons: ['Temporary email identifier'],
      }),
    ]);

    await expect(
      page.getByRole('link', { name: 'Analysis', exact: true }),
    ).toHaveCount(0);

    const analysis = await page.request.post(
      '/api/admin/acquisition-stories/analysis',
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(analysis.status()).toBe(404);
  });

  test('welcome team list prioritises shared languages and marks a welcomed member', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Shared languages appear first and are emphasised except English.',
      'Sending a welcome message assigns the sender and subtly fades the row.',
    ]);

    const recipient = createUser({
      firstName: 'Fictional',
      lastName: 'Traveller',
    });
    const welcomer = createUser({
      firstName: 'Fictional',
      lastName: 'Welcomer',
    });
    const setupContext = await createIsolatedContext(browser, baseURL);
    const welcomerContext = await createIsolatedContext(browser, baseURL);
    let recipientId: ObjectId | undefined;
    let welcomerId: ObjectId | undefined;
    try {
      await registerViaApi(setupContext.request, recipient);
      recipientId = await withE2eDb(
        async db =>
          (await db
            .collection('users')
            .findOne({ username: recipient.username }))!._id,
      );
      await registerViaApi(welcomerContext.request, welcomer);
      await withE2eDb(async db => {
        const welcomerDoc = (await db
          .collection('users')
          .findOne({ username: welcomer.username }))!;
        welcomerId = welcomerDoc._id;
        await Promise.all([
          db.collection('users').updateOne(
            { _id: recipientId },
            {
              $set: {
                acquisitionStory: 'A fictional traveller heard from a friend.',
                languages: ['spa', 'eng', 'fre'],
                public: true,
              },
            },
          ),
          db.collection('users').updateOne(
            { _id: welcomerId },
            {
              $set: {
                roles: ['user', 'welcome-team'],
                description:
                  'I enjoy welcoming travellers, sharing fictional local tips and meeting people from around the world. I volunteer with the welcome team and help new members find their way around the community.',
                languages: ['eng', 'fre'],
                public: true,
              },
            },
          ),
        ]);
      });

      const welcomerPage = await welcomerContext.newPage();
      await signInViaApi(welcomerPage, welcomerContext.request, welcomer);
      await welcomerPage.goto('/admin/acquisition-stories');
      const row = welcomerPage
        .locator('tr')
        .filter({ hasText: recipient.username });
      await expect(row.getByText('Unassigned', { exact: true })).toBeVisible();

      const languages = row.locator('td').last();
      await expect(languages.locator('li')).toHaveText([
        'English',
        'French',
        'Spanish',
      ]);
      await expect(
        languages.locator('li').nth(0).locator('strong'),
      ).toHaveCount(0);
      await expect(languages.locator('li').nth(1).locator('strong')).toHaveText(
        'French',
      );
      await expect(
        languages.locator('li').nth(2).locator('strong'),
      ).toHaveCount(0);

      const sent = await welcomerContext.request.post('/api/messages', {
        data: {
          userTo: String(recipientId),
          content: `A fictional welcome ${Date.now()}`,
        },
      });
      expect(sent.ok(), await sent.text()).toBeTruthy();

      await welcomerPage.reload();
      const contactedRow = welcomerPage
        .locator('tr')
        .filter({ hasText: recipient.username });
      await expect(contactedRow).toHaveClass(
        /admin-acquisition-stories-contacted/,
      );
      await expect(contactedRow).toHaveCSS('opacity', '1');
      await expect(contactedRow).toHaveCSS('color', 'rgb(71, 71, 71)');
      await expect(contactedRow.locator('td').last()).toHaveCSS(
        'color',
        'rgb(71, 71, 71)',
      );
      await expect(
        contactedRow.getByRole('link', { name: 'Fictional Welcomer' }),
      ).toHaveAttribute('href', `/profile/${welcomer.username}`);
      const contactTime = contactedRow.locator('td').nth(8).locator('time');
      await expect(contactTime).toHaveAttribute(
        'datetime',
        /\d{4}-\d{2}-\d{2}T/,
      );
      await expect(contactTime).toHaveText(/\d{4}-\d{2}-\d{2}/);
      const welcomerLink = contactedRow.getByRole('link', {
        name: 'Fictional Welcomer',
      });
      await welcomerLink.focus();
      await expect(welcomerLink).toBeFocused();
      await contactedRow.screenshot({
        path: 'coverage/e2e/acquisition-welcomed-row.png',
      });
    } finally {
      await withE2eDb(async db => {
        const ownedUsers = await db
          .collection('users')
          .find({ username: { $in: [recipient.username, welcomer.username] } })
          .project({ _id: 1 })
          .toArray();
        const ids = [
          ...ownedUsers.map(user => user._id),
          recipientId,
          welcomerId,
        ]
          .filter(Boolean)
          .filter(
            (id, index, all) =>
              all.findIndex(other => String(other) === String(id)) === index,
          );
        if (ids.length) {
          await db.collection('messages').deleteMany({
            $or: [{ userTo: { $in: ids } }, { userFrom: { $in: ids } }],
          });
        }
        await db.collection('users').deleteMany({
          username: { $in: [recipient.username, welcomer.username] },
        });
      });
      await setupContext.close();
      await welcomerContext.close();
    }
  });
});
