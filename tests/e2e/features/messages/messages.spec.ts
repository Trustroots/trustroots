import {
  expectPresent,
  annotateFeature,
  test,
  expect,
} from '../../support/fixtures.mts';
import { ObjectId } from 'mongodb';

import {
  SEEDED_CONVERSATIONS,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import {
  findUserByUsername,
  removeUserByUsername,
  updateUserByUsername,
  withE2eDb,
} from '../../support/db.mts';

test.describe('seeded message flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('unreplied conversations and totals follow reading and replying', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Unreplied conversations and all three totals reflect reading and replying.',
    ]);
    const member = createUser();
    const setupContext = await createIsolatedContext(browser, baseURL);
    try {
      await registerViaApi(setupContext.request, member);
    } finally {
      await setupContext.close();
    }
    await updateUserByUsername(member.username, {
      $set: {
        public: true,
        description:
          'A fictional member interested in meeting people and sharing travel stories.',
      },
    });
    const recipient = await findUserByUsername(member.username);
    expectPresent(recipient);
    const sender = {
      _id: new ObjectId(),
      username: `unreplied-${new ObjectId()}`,
      email: `unreplied-${new ObjectId()}@example.test`,
      displayName: 'Fictional Initial Sender',
      public: true,
      roles: ['user'],
    };
    const message = {
      _id: new ObjectId(),
      userFrom: sender._id,
      userTo: recipient._id,
      content: 'A fictional initial invitation.',
      created: new Date(),
      read: false,
      shadowHidden: false,
    };
    const thread = {
      _id: new ObjectId(),
      userFrom: sender._id,
      userTo: recipient._id,
      message: message._id,
      updated: message.created,
      read: false,
    };
    await withE2eDb(async db => {
      await db.collection('users').insertOne(sender);
      await db.collection('messages').insertOne(message);
      await db.collection('threads').insertOne(thread);
    });
    await signInViaApi(page, page.request, member);
    const assertCounts = async (unread: number, unreplied: number) => {
      for (const [label, count] of [
        ['All', 1],
        ['Unread', unread],
        ['Unreplied', unreplied],
      ]) {
        await expect(
          page.getByRole('option', {
            name: new RegExp(`${label} conversations`),
          }),
        ).toContainText(`(${count})`);
      }
    };
    await page.goto('/messages');
    await assertCounts(1, 1);
    for (const width of [1280, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(
        page.getByRole('combobox', { name: 'Conversation filter' }),
      ).toBeInViewport();
      expect(
        await page
          .locator('html')
          .evaluate(element => element.scrollWidth <= element.clientWidth),
      ).toBeTruthy();
    }
    await page
      .getByRole('combobox', { name: 'Conversation filter' })
      .selectOption('unreplied');
    await expect(page).toHaveURL(/filter=unreplied/);
    await page.getByText(sender.displayName).click();
    await expect(page.getByText(message.content)).toBeVisible();
    await page.goto('/messages?filter=unreplied');
    await assertCounts(0, 1);
    await expect(page.getByText(sender.displayName)).toBeVisible();
    await page.getByText(sender.displayName).click();
    const editor = page.locator('#message-reply-content');
    await editor.click();
    await page.keyboard.insertText('A fictional first answer.');
    const sent = page.waitForResponse(
      response =>
        response.url().endsWith('/api/messages') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.locator('#messageReplySubmit').click();
    await sent;
    await page.goto('/messages?filter=unreplied');
    await assertCounts(0, 0);
    await expect(page.getByRole('alert')).toHaveText(
      'No unreplied conversations.',
    );
    // A newer incoming message must not make an answered conversation unreplied.
    await withE2eDb(async db => {
      const followUp = {
        ...message,
        _id: new ObjectId(),
        created: new Date(),
        content: 'A fictional follow-up.',
      };
      await db.collection('messages').insertOne(followUp);
      await db.collection('threads').updateOne(
        { _id: thread._id },
        {
          $set: {
            userFrom: sender._id,
            userTo: recipient._id,
            message: followUp._id,
            updated: followUp.created,
            read: false,
          },
        },
      );
    });
    await page.reload();
    await assertCounts(1, 0);
    await expect(page.getByRole('alert')).toHaveText(
      'No unreplied conversations.',
    );
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
    expectPresent(recipient);
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

    await page
      .getByRole('combobox', { name: 'Conversation filter' })
      .selectOption('unread');
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
    expectPresent(incomingBubble);
    expectPresent(outgoingBubble);
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
    expectPresent(senderDoc);
    expectPresent(recipientDoc);
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
