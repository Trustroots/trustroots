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

  test('inbox API returns sanitized thread excerpts', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox lists seeded conversation.',
      'Inbox excludes shadow-hidden conversations.',
    ]);

    const inbox = await page.request.get('/api/messages', {
      params: { limit: 5 },
    });
    expect(inbox.ok()).toBeTruthy();

    const threads = await inbox.json();
    expect(Array.isArray(threads)).toBeTruthy();
    expect(threads.length).toBeGreaterThan(0);

    const seededThread = threads.find(thread =>
      [thread.userFrom?.username, thread.userTo?.username].includes(
        SEEDED_MEMBERS[1].username,
      ),
    );
    expect(seededThread).toBeTruthy();
    expect(seededThread.message.excerpt).toContain(
      SEEDED_CONVERSATIONS.berlinPortland.latestReply,
    );
    expect(seededThread.message.content).toBeUndefined();
    expect(seededThread.message.spam).toBeUndefined();
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

  test('member thread API hides shadow-hidden messages from the recipient', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'safety.shadowban-hiding', [
      'Shadowbanned profile is hidden from members.',
      'Shadow-hidden messages are not visible to regular recipients.',
      'Admin tools can still inspect shadow-hidden content.',
    ]);

    const response = await request.get(`/api/messages/${SEEDED_SHADOW.id}`);
    expect(response.ok()).toBeTruthy();

    const messages = await response.json();
    const contents = messages.map(message => message.content);
    expect(contents).not.toContain(SEEDED_SHADOW_MESSAGE);
  });
});
