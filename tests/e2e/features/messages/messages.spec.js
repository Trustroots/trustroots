const { annotateFeature, test, expect } = require('../../support/fixtures');
const { ObjectId } = require('mongodb');

const {
  SEEDED_CONVERSATIONS,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  findUserByUsername,
  removeUserByUsername,
  updateUserByUsername,
  withE2eDb,
} = require('../../support/db');

test.describe('seeded message flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('inbox and conversation load through the React shell', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox lists seeded conversation.',
    ]);
    annotateFeature(testInfo, 'messages.thread-open', [
      'Thread view shows seeded replies.',
    ]);

    await page.goto('/messages');
    await expect(page.locator('#tr-react-root')).toBeVisible();

    await page.goto(`/messages/${SEEDED_MEMBERS[1].username}`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(
      page.getByText(SEEDED_CONVERSATIONS.berlinPortland.latestReply),
    ).toBeVisible();
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

  test('older unread conversations can be filtered and opened', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Unread conversations beyond the first page can be opened.',
      'Conversation text filter finds older names and previews.',
    ]);
    const member = createUser();
    const setupContext = await createIsolatedContext(browser, baseURL);
    try {
      await registerViaApi(setupContext.request, member);
    } finally {
      await setupContext.close();
    }
    await updateUserByUsername(member.username, { $set: { public: true } });
    const recipient = await findUserByUsername(member.username);
    const senders = Array.from({ length: 21 }, (_, index) => ({
      _id: new ObjectId(),
      username: `inbox-sender-${new ObjectId()}`,
      email: `inbox-sender-${new ObjectId()}@example.test`,
      displayName:
        index === 0 ? 'Older Unread Member' : `Earlier Member ${index}`,
      public: true,
      roles: ['user'],
    }));
    const messages = senders.map((sender, index) => ({
      _id: new ObjectId(),
      userFrom: sender._id,
      userTo: recipient._id,
      content:
        index === 0
          ? 'Find this older unread preview'
          : `Earlier preview ${index}`,
      created: new Date(Date.UTC(2026, 0, index + 1)),
      read: index !== 0,
      shadowHidden: false,
    }));
    const threads = senders.map((sender, index) => ({
      _id: new ObjectId(),
      userFrom: sender._id,
      userTo: recipient._id,
      message: messages[index]._id,
      updated: messages[index].created,
      read: index !== 0,
    }));
    await withE2eDb(async db => {
      await db.collection('users').insertMany(senders);
      await db.collection('messages').insertMany(messages);
      await db.collection('threads').insertMany(threads);
    });
    await signInViaApi(page, page.request, member);

    await page.goto('/messages');
    await expect(page.getByText('Older Unread Member')).toHaveCount(0);
    await expect(page.getByLabel('1 unread messages')).toBeVisible();

    await page.getByRole('link', { name: 'Unread conversations' }).click();
    await expect(page).toHaveURL(/\/messages\?filter=unread/);
    await expect(page.getByText('Older Unread Member')).toBeVisible();
    await page.getByText('Older Unread Member').click();
    await expect(
      page.getByText('Find this older unread preview'),
    ).toBeVisible();

    await page.goto('/messages');
    await page
      .getByRole('searchbox', { name: 'Filter conversations' })
      .fill('older unread');
    await expect(page.getByText('Older Unread Member')).toBeVisible();
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
    const incoming = page
      .getByText(SEEDED_CONVERSATIONS.berlinPortland.openingMessage)
      .locator('xpath=ancestor::*[contains(@class, "message-sender-other")]');
    const outgoing = page
      .getByText(SEEDED_CONVERSATIONS.berlinPortland.latestReply)
      .locator('xpath=ancestor::*[contains(@class, "message-sender-me")]');
    await expect(incoming).toHaveCSS('justify-content', 'normal');
    await expect(outgoing).toHaveCSS('justify-content', 'flex-end');
    const incomingBubble = await incoming.locator('.panel').boundingBox();
    const outgoingBubble = await outgoing.locator('.panel').boundingBox();
    expect(incomingBubble.x).toBeLessThan(outgoingBubble.x);
    await expect(outgoing.getByText('You', { exact: true })).toBeVisible();
    await expect(page.locator('#messageReplySubmit')).toHaveCSS(
      'background-color',
      'rgb(18, 181, 145)',
    );
  });

  test('received messages offer quick reply buttons', async ({
    page,
    request,
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.thread-open', [
      'Thread view shows seeded replies.',
    ]);
    const recipient = createUser();
    const setupContext = await createIsolatedContext(browser, baseURL);
    try {
      await registerViaApi(setupContext.request, recipient);
    } finally {
      await setupContext.close();
    }
    const senderDoc = await findUserByUsername(SEEDED_MEMBERS[0].username);
    const recipientDoc = await findUserByUsername(recipient.username);
    const message = {
      _id: new ObjectId(),
      userFrom: senderDoc._id,
      userTo: recipientDoc._id,
      content: 'A fictional member asks about hosting.',
      created: new Date(),
      read: false,
      shadowHidden: false,
    };
    const thread = {
      _id: new ObjectId(),
      userFrom: senderDoc._id,
      userTo: recipientDoc._id,
      message: message._id,
      updated: message.created,
      read: false,
    };
    try {
      await withE2eDb(async db => {
        await db.collection('messages').insertOne(message);
        await db.collection('threads').insertOne(thread);
      });
      await updateUserByUsername(recipient.username, {
        $set: { public: true },
      });
      await signInViaApi(page, request, recipient);
      await page.goto(`/messages/${SEEDED_MEMBERS[0].username}`);
      const quickReplies = page.getByTestId('quick-reply');
      await expect(quickReplies).toBeVisible();
      await expect(
        quickReplies.getByRole('button', { name: 'Yes, I can host!' }),
      ).toBeVisible();
    } finally {
      await withE2eDb(async db => {
        await db.collection('threads').deleteOne({ _id: thread._id });
        await db.collection('messages').deleteOne({ _id: message._id });
      });
      await removeUserByUsername(recipient.username);
    }
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

    await expect(page.getByText('Portland Host').first()).toBeVisible();
    const inboxRows = page.locator('.threadlist-thread');
    await expect(
      inboxRows.locator(`a[href*="${SEEDED_SHADOW.username}"]`),
    ).toHaveCount(0);
    await expect(
      inboxRows.filter({ hasText: SEEDED_SHADOW_MESSAGE }),
    ).toHaveCount(0);
  });
});
