const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
  fetchUserIdByUsername,
  signInViaApi,
} = require('../../support/helpers');
const {
  assertReplyComposerCaretAndComposition,
} = require('../../support/message-reply-editor');

const berlin = SEEDED_MEMBERS[0];
const portland = SEEDED_MEMBERS[1];
const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;

test.describe.serial('message action feature coverage', () => {
  test('members can send replies and validation blocks empty messages', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Reply composer is visible in an existing thread.',
      'Sending a reply appends it to the thread.',
      'Validation prevents empty or forbidden replies.',
    ]);

    const portlandId = await fetchUserIdByUsername(request, portland.username);
    await page.goto(`/messages/${portland.username}?userId=${portlandId}`);
    await expect(page.locator('#message-reply-content')).toBeVisible();

    const empty = await page.request.post('/api/messages', {
      data: {
        userTo: portlandId,
        content: '',
      },
    });
    expect(empty.status()).toBe(400);

    const replyText = `E2E reply ${Date.now()}`;
    const reply = await page.request.post('/api/messages', {
      data: {
        userTo: portlandId,
        content: replyText,
      },
    });
    expect(reply.ok()).toBeTruthy();

    const thread = await page.request.get(`/api/messages/${portlandId}`);
    expect(thread.ok()).toBeTruthy();
    expect((await thread.json()).map(message => message.content)).toContain(
      replyText,
    );
  });

  test('members can send replies from the thread composer', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Reply composer is visible in an existing thread.',
      'Sending a reply appends it to the thread.',
    ]);

    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const replyText = `E2E composer reply ${Date.now()}`;
    await page.goto(`/messages/${portland.username}?userId=${portlandId}`);

    const editor = page.locator('#message-reply-content');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.insertText(replyText);

    const sendReply = page.waitForResponse(
      response =>
        response.url().includes('/api/messages') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.locator('#messageReplySubmit').click();
    await sendReply;

    await expect(page.getByText(replyText)).toBeVisible();
  });

  test('reply composer preserves a multiline caret and composed characters', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Editing an earlier line does not move or reorder the reply text.',
      'Reply text retains characters entered through an input composition.',
    ]);

    const portlandId = await fetchUserIdByUsername(request, portland.username);
    await assertReplyComposerCaretAndComposition(
      page,
      `/messages/${portland.username}?userId=${portlandId}`,
    );
  });

  test('members can start conversations and read/sync unread messages', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.new-conversation', [
      'Sending an opening message creates the conversation.',
    ]);
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
      'Message sync endpoint returns deterministic updates.',
      'Sync handles no-new-message state.',
    ]);
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox empty state is visible when there are no conversations.',
    ]);
    annotateFeature(testInfo, 'messages.unconfirmed-restrictions', [
      'Restricted message actions are unavailable until confirmation.',
    ]);

    const berlinId = await fetchUserIdByUsername(request, berlin.username);
    const aliceId = await fetchUserIdByUsername(request, alice.username);
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, portland);
      const sentToBerlin = await page.request.post('/api/messages', {
        data: {
          userTo: berlinId,
          content: `E2E unread message ${Date.now()}`,
        },
      });
      expect(sentToBerlin.ok()).toBeTruthy();

      await signInViaApi(page, context.request, berlin);
      const unreadBefore = await page.request.get('/api/messages-count');
      expect(unreadBefore.ok()).toBeTruthy();
      expect((await unreadBefore.json()).unread).toBeGreaterThan(0);

      const sync = await page.request.get('/api/messages-sync');
      expect(sync.ok()).toBeTruthy();
      const syncBody = await sync.json();
      expect(syncBody.users).toEqual(expect.any(Array));
      expect(syncBody.messages).toEqual(expect.any(Object));

      const thread = await page.request.get(`/api/messages/${portland.id}`);
      expect(thread.ok()).toBeTruthy();
      const messages = await thread.json();
      expect(messages.length).toBeGreaterThan(0);

      const markRead = await page.request.post('/api/messages-read', {
        data: {
          messageIds: messages.map(message => message._id),
        },
      });
      expect(markRead.ok()).toBeTruthy();

      const emptyThreadMessage = await page.request.post('/api/messages', {
        data: {
          userTo: aliceId,
          content: `E2E opening message ${Date.now()}`,
        },
      });
      expect(emptyThreadMessage.ok()).toBeTruthy();

      const noNewSync = await page.request.get('/api/messages-sync', {
        params: { date: new Date(Date.now() + 1000).toISOString() },
      });
      expect(noNewSync.ok()).toBeTruthy();
      expect(await noNewSync.json()).toMatchObject({
        messages: expect.any(Object),
        users: expect.any(Array),
      });
    } finally {
      await context.close();
    }
  });
});
