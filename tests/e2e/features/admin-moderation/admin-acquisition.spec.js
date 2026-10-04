const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_ADMIN,
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const { withE2eDb } = require('../../support/db');

test.describe('admin acquisition feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin acquisition story tools return deterministic rows and analysis', async ({
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
    ]);
    annotateFeature(testInfo, 'admin.acquisition-analysis', [
      'Acquisition story analysis page loads.',
      'Analysis API returns deterministic analysis.',
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
    ).toHaveAttribute('href', '/admin/user?id=665000000000000000000004');
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
    const storyRows = await stories.json();
    const aliceStory = storyRows.find(item =>
      /hitchhiking friends/i.test(item.acquisitionStory),
    );
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

    await page.goto('/admin/acquisition-stories/analysis');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories\/analysis/);

    const analysis = await page.request.post(
      '/api/admin/acquisition-stories/analysis',
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(analysis.ok()).toBeTruthy();
    expect(Object.keys(await analysis.json()).length).toBeGreaterThan(0);
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
    let recipientId;
    let welcomerId;
    try {
      await registerViaApi(setupContext.request, recipient);
      recipientId = await withE2eDb(
        async db =>
          (
            await db
              .collection('users')
              .findOne({ username: recipient.username })
          )._id,
      );
      await registerViaApi(welcomerContext.request, welcomer);
      await withE2eDb(async db => {
        const welcomerDoc = await db
          .collection('users')
          .findOne({ username: welcomer.username });
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
      const contactTime = contactedRow.locator('td').nth(7).locator('time');
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
