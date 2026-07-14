const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_CONVERSATIONS,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  fetchUserIdByUsername,
  signInViaApi,
} = require('../../support/helpers');

test.describe('seeded message flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('inbox lists the seeded conversation with Portland Host', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox lists seeded conversation.',
      'Inbox empty state is visible when there are no conversations.',
      'Inbox excludes shadow-hidden conversations.',
    ]);

    await page.goto('/messages');

    await expect(page).toHaveURL(/\/messages/);
    await expect(page.getByText('Portland Host').first()).toBeVisible();
  });

  test('thread view shows the seeded reply', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.thread-open', [
      'Thread view opens from inbox.',
      'Thread view shows seeded replies.',
      'Thread can be opened by username or userId route/query.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);

    await page.goto(`/messages/${portland.username}?userId=${portlandId}`);

    await expect(
      page.getByText(SEEDED_CONVERSATIONS.berlinPortland.latestReply),
    ).toBeVisible();
    await expect(
      page.getByText(SEEDED_CONVERSATIONS.berlinPortland.openingMessage),
    ).toBeVisible();
  });

  test('inbox does not list the shadowbanned sender', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'safety.shadowban-hiding', [
      'Shadowbanned profile is hidden from members.',
      'Shadow-hidden messages are not visible to regular recipients.',
      'Admin tools can still inspect shadow-hidden content.',
    ]);

    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox lists seeded conversation.',
      'Inbox empty state is visible when there are no conversations.',
      'Inbox excludes shadow-hidden conversations.',
    ]);

    await page.goto('/messages');

    await expect(page.getByText(SEEDED_SHADOW.firstName)).toHaveCount(0);
    await expect(page.getByText(SEEDED_SHADOW_MESSAGE)).toHaveCount(0);
  });
});
