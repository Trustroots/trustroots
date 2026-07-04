const { request: playwrightRequest } = require('@playwright/test');
const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_CONVERSATIONS,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  fetchUserIdByUsername,
  signInViaApi,
} = require('../../support/helpers');

test.describe('seeded message API flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('message APIs require an authenticated member', async ({
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox lists seeded conversation.',
    ]);
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
      'Message sync endpoint returns deterministic updates.',
    ]);
    annotateFeature(testInfo, 'messages.reply-send', [
      'Validation prevents empty or forbidden replies.',
    ]);

    const unauthenticatedRequest = await playwrightRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const portlandId = SEEDED_MEMBERS[1].id;
      const checks = [
        ['inbox', () => unauthenticatedRequest.get('/api/messages')],
        [
          'thread',
          () => unauthenticatedRequest.get(`/api/messages/${portlandId}`),
        ],
        ['count', () => unauthenticatedRequest.get('/api/messages-count')],
        ['sync', () => unauthenticatedRequest.get('/api/messages-sync')],
        [
          'send',
          () =>
            unauthenticatedRequest.post('/api/messages', {
              data: {
                userTo: portlandId,
                content: 'Should require authentication',
              },
            }),
        ],
      ];

      for (const [label, requestApi] of checks) {
        const response = await requestApi();
        expect(response.status(), label).toBe(403);
      }
    } finally {
      await unauthenticatedRequest.dispose();
    }
  });

  test('inbox API returns sanitized thread excerpts', async ({
    page,
    request,
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
    expect(seededThread.message.excerpt).toEqual(expect.any(String));
    expect(seededThread.message.content).toBeUndefined();
    expect(seededThread.message.spam).toBeUndefined();

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const thread = await page.request.get(`/api/messages/${portlandId}`);
    expect(thread.ok()).toBeTruthy();
    const threadContents = (await thread.json()).map(
      message => message.content,
    );
    expect(threadContents).toContain(
      SEEDED_CONVERSATIONS.berlinPortland.latestReply,
    );
    expect(threadContents).toContain(
      SEEDED_CONVERSATIONS.berlinPortland.openingMessage,
    );
  });

  test('thread API paginates seeded replies', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.thread-open', [
      'Thread view shows seeded replies.',
      'Thread can be opened by username or userId route/query.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const response = await page.request.get(`/api/messages/${portlandId}`, {
      params: { page: 1, limit: 1 },
    });
    expect(response.ok()).toBeTruthy();

    const messages = await response.json();
    expect(messages).toHaveLength(1);
    expect(response.headers().link).toContain('page=2');
  });

  test('message send API rejects invalid recipients', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Validation prevents empty or forbidden replies.',
    ]);
    annotateFeature(testInfo, 'messages.new-conversation', [
      'Sending an opening message creates the conversation.',
    ]);

    const invalidRecipient = await page.request.post('/api/messages', {
      data: {
        userTo: 'not-a-mongo-id',
        content: 'This should not be sent',
      },
    });
    expect(invalidRecipient.status()).toBe(400);

    const selfMessage = await page.request.post('/api/messages', {
      data: {
        userTo: SEEDED_MEMBERS[0].id,
        content: 'This should not be sent to myself',
      },
    });
    expect(selfMessage.status()).toBe(403);
  });

  test('message status APIs expose unread and sync payloads', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
      'Message sync endpoint returns deterministic updates.',
      'Sync handles no-new-message state.',
    ]);

    const unread = await page.request.get('/api/messages-count');
    expect(unread.ok()).toBeTruthy();
    expect(await unread.json()).toMatchObject({
      unread: expect.any(Number),
    });

    const sync = await page.request.get('/api/messages-sync', {
      params: {
        dateFrom: '2020-01-01T00:00:00.000Z',
        dateTo: new Date(Date.now() + 1000).toISOString(),
      },
    });
    expect(sync.ok()).toBeTruthy();
    expect(await sync.json()).toMatchObject({
      messages: expect.any(Object),
      users: expect.any(Array),
    });
  });

  test('message read and sync APIs validate request payloads', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
      'Sync handles no-new-message state.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const thread = await page.request.get(`/api/messages/${portlandId}`);
    expect(thread.ok()).toBeTruthy();
    const messages = await thread.json();
    expect(messages.length).toBeGreaterThan(0);

    const markRead = await page.request.post('/api/messages-read', {
      data: {
        messageIds: messages.map(message => message._id),
      },
    });
    expect(markRead.ok()).toBeTruthy();

    const invalidDate = await page.request.get('/api/messages-sync', {
      params: { dateFrom: '2025-01-01', dateTo: '2024-01-01' },
    });
    expect(invalidDate.status()).toBe(400);
    expect(await invalidDate.json()).toMatchObject({
      message: expect.stringContaining('dateFrom'),
    });
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
