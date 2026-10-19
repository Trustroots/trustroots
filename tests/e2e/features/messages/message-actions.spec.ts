/* global document */

import {
  annotateFeature,
  expectPresent,
  expect,
  test,
} from '../../support/fixtures.mts';

import {
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
  createIsolatedContext,
  createUser,
  registerViaApi,
  fetchUserIdByUsername,
  signInViaApi,
} from '../../support/helpers.mts';
import type { Page, Request } from '@playwright/test';
import { updateUserByUsername } from '../../support/db.mts';
import { assertReplyComposerCaretAndComposition } from '../../support/message-reply-editor.mts';

const berlin = SEEDED_MEMBERS[0];
const portland = SEEDED_MEMBERS[1];
const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;

for (const width of [390, 1280]) {
  test(`hosting acknowledgement is optional and required only for a new conversation at ${width}px`, async ({
    page,
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.new-conversation', [
      'Opted-in hosts require acknowledgement only for a new conversation.',
    ]);
    const host = createUser();
    const context = await createIsolatedContext(browser, baseURL);
    try {
      await registerViaApi(context.request, host);
      await updateUserByUsername(host.username, { $set: { public: true } });
      const hostPage = await context.newPage();
      await signInViaApi(hostPage, context.request, host);
      const created = await context.request.post('/api/offers', {
        data: {
          type: 'host',
          status: 'yes',
          description: '<p>Please arrive before sunset.</p>',
          location: [12, 34],
        },
      });
      expect(created.ok()).toBeTruthy();
      await hostPage.goto('/offer/host#description');
      const preference = hostPage.getByRole('checkbox', {
        name: /Require guests to acknowledge/,
      });
      await expect(preference).not.toBeChecked();
      await signInViaApi(page, request, berlin);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/messages/${host.username}`);
      const editor = page.locator('#message-reply-content');
      await editor.fill('A fictional opening request.');
      await expect(page.locator('#messageReplySubmit')).toBeEnabled();

      // The host opts in while the guest is already writing a message.
      await preference.check();
      await hostPage.getByRole('button', { name: 'Save and Exit' }).click();
      await expect(hostPage).toHaveURL(new RegExp(`/profile/${host.username}`));
      await hostPage.goto('/offer/host#description');
      await expect(preference).toBeChecked();

      const hostId = await fetchUserIdByUsername(request, host.username);
      const rejected = await page.request.post('/api/messages', {
        data: { userTo: hostId, content: 'A fictional request.' },
      });
      expect(rejected.status()).toBe(400);
      expect((await rejected.json()).error).toBe(
        'hosting-description-acknowledgement-required',
      );
      await page.locator('#messageReplySubmit').click();
      const acknowledgement = page.getByRole('checkbox', {
        name: 'I have read this host’s hosting description and requirements.',
      });
      await expect(
        page.getByText('Please arrive before sunset.'),
      ).toBeVisible();
      await expect(acknowledgement).not.toBeChecked();
      await expect(editor).toHaveText('A fictional opening request.');
      await expect(page.locator('#messageReplySubmit')).toBeDisabled();
      await editor.press('Control+Enter');
      await expect(editor).toHaveText('A fictional opening request.');
      await acknowledgement.check();
      await expect(page.locator('#messageReplySubmit')).toBeInViewport();
      const sent = page.waitForResponse(
        response =>
          new URL(response.url()).pathname === '/api/messages' &&
          response.request().method() === 'POST',
      );
      await page.locator('#messageReplySubmit').click();
      expect((await sent).ok()).toBeTruthy();
      await expect(acknowledgement).toHaveCount(0);
      await page.reload();
      await expect(editor).toBeVisible();
      await expect(acknowledgement).toHaveCount(0);
      const reply = await page.request.post('/api/messages', {
        data: { userTo: hostId, content: 'A fictional follow-up.' },
      });
      expect(reply.ok()).toBeTruthy();
    } finally {
      await context.close();
    }
  });
}

async function dragComposer(
  page: Page,
  layout: 'mobile' | 'desktop',
  distance: number,
): Promise<void> {
  const handle = page.getByRole('separator', { name: 'Resize message editor' });
  const box = await handle.boundingBox();
  expectPresent(box);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (layout === 'mobile') {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - distance }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - distance, { steps: 10 });
    await page.mouse.up();
  }
}

test.describe.serial('message action feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, berlin);
  });

  for (const [layout, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test(`${layout} members can drag the composer larger and smaller`, async ({
      page,
    }, testInfo) => {
      annotateFeature(testInfo, 'messages.reply-send', [
        'Members can enlarge the composer without changing their draft.',
        'Resized controls remain visible when the available height changes.',
      ]);
      await page.setViewportSize(viewport);
      await page.goto(`/messages/${portland.username}`);
      const editor = page.locator('#message-reply-content');
      const draft = Array(12).fill('A fictional draft line.').join('\n');
      await editor.fill(draft);
      const originalMarkup = await editor.innerHTML();
      const collapsedHeight = await editor.evaluate(el => el.clientHeight);
      const handle = page.getByRole('separator', {
        name: 'Resize message editor',
      });
      await dragComposer(page, layout, 350);
      const expanded = await editor.evaluate(el => ({
        height: el.clientHeight,
        contentHeight: el.scrollHeight,
      }));
      expect(expanded.height).toBeGreaterThan(collapsedHeight);
      expect(expanded.contentHeight).toBeLessThanOrEqual(expanded.height);
      expect(await editor.innerHTML()).toBe(originalMarkup);

      await dragComposer(page, layout, -100);
      expect(await editor.evaluate(el => el.clientHeight)).toBeLessThan(
        expanded.height,
      );
      expect(await editor.innerHTML()).toBe(originalMarkup);
      await dragComposer(page, layout, 100);

      await page.setViewportSize({ width: viewport.width, height: 300 });
      await page.evaluate(() => {
        document.documentElement.style.setProperty(
          '--trustroots-keyboard-inset',
          '80px',
        );
      });
      await expect(handle).toBeInViewport();
      await expect(page.locator('#messageReplySubmit')).toBeInViewport();
      const shortLayout = await editor.evaluate(el => ({
        height: el.clientHeight,
        contentHeight: el.scrollHeight,
        bottom: el.getBoundingClientRect().bottom,
        actionsTop: document
          .querySelector('.message-reply-actions')!
          .getBoundingClientRect().top,
      }));
      expect(shortLayout.height).toBeGreaterThan(0);
      expect(shortLayout.contentHeight).toBeGreaterThan(shortLayout.height);
      expect(shortLayout.bottom).toBeLessThanOrEqual(shortLayout.actionsTop);
      await handle.focus();
      await page.keyboard.press('Home');
      await expect(handle).toHaveAttribute('aria-valuenow', '88');
      expect(await editor.innerHTML()).toBe(originalMarkup);
    });

    test(`${layout} members can preview, edit and send a formatted draft`, async ({
      page,
      request,
    }, testInfo) => {
      annotateFeature(testInfo, 'messages.draft-preview', [
        'Members can preview and edit a formatted draft without sending it.',
        'Sending from preview sends the original draft and returns to editing.',
        'Preview follows message link rules on desktop and mobile.',
      ]);
      await page.setViewportSize(viewport);
      const recipientId = await fetchUserIdByUsername(
        request,
        portland.username,
      );
      await page.goto(`/messages/${portland.username}?userId=${recipientId}`);
      const editor = page.locator('#message-reply-content');
      await dragComposer(page, layout, 200);
      const selectedHeight = await page
        .locator('#message-reply')
        .evaluate(el => el.style.height);
      const draft = `<p><strong>Fictional preview ${Date.now()}</strong></p><p><a href="https://outside.example/">External label</a> <a href="/profile/fictional">Internal label</a></p>`;
      await editor.evaluate((element, content) => {
        element.innerHTML = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, draft);
      const sends: Request[] = [];
      page.on('request', (outgoing: Request) => {
        if (
          new URL(outgoing.url()).pathname === '/api/messages' &&
          outgoing.method() === 'POST'
        )
          sends.push(outgoing);
      });
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      const preview = page.getByRole('region', { name: 'Message preview' });
      await expect(preview.locator('b')).toContainText('Fictional preview');
      await expect(
        preview.getByRole('link', { name: 'External label' }),
      ).toHaveCount(0);
      await expect(preview).toContainText('Internal label');
      await expect(preview.locator('a')).toHaveCount(0);
      expect(sends).toHaveLength(0);
      await expect(
        page.getByRole('button', { name: 'Edit', exact: true }),
      ).toBeInViewport();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(editor).toBeFocused();
      expect(await editor.innerHTML()).toBe(draft);
      expect(
        await page.locator('#message-reply').evaluate(el => el.style.height),
      ).toBe(selectedHeight);
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await expect(preview.locator('b')).toContainText('Fictional preview');
      const sent = page.waitForResponse(
        response =>
          new URL(response.url()).pathname === '/api/messages' &&
          response.request().method() === 'POST' &&
          response.ok(),
      );
      await page.locator('#messageReplySubmit').click();
      await sent;
      expect(sends).toHaveLength(1);
      expect(sends[0].postDataJSON().content).toBe(draft);
      await expect(preview).toHaveCount(0);
      await expect(editor).toBeFocused();
      await expect(editor).toBeEmpty();
      await expect(
        page.locator('.message-reply-resize-handle[aria-valuenow]'),
      ).toHaveCount(0);
      await expect(page.locator('.message .panel-body b').last()).toContainText(
        'Fictional preview',
      );
    });
  }

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
    expect(
      ((await thread.json()) as { content: string }[]).map(
        message => message.content,
      ),
    ).toContain(replyText);
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

  test('desktop reply editor is focused on opening and after sending', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-focus', [
      'The desktop reply editor receives focus when a conversation opens.',
      'The recreated reply editor receives focus after sending.',
    ]);

    await page.setViewportSize({ width: 1280, height: 800 });
    const recipientId = await fetchUserIdByUsername(request, portland.username);
    await page.goto(`/messages/${portland.username}?userId=${recipientId}`);
    const editor = page.locator('#message-reply-content');
    await expect(editor).toBeFocused();

    const replyText = `Fictional focus check ${Date.now()}`;
    await page.keyboard.insertText(replyText);
    const sent = page.waitForResponse(
      response =>
        response.url().endsWith('/api/messages') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.locator('#messageReplySubmit').click();
    await sent;
    await expect(page.getByText(replyText)).toBeVisible();
    await expect(editor).toBeFocused();
  });

  test('all links in messages are displayed as plain text', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.external-links', [
      'External message links are visible but cannot be clicked.',
    ]);

    const recipientId = await fetchUserIdByUsername(request, portland.username);
    const message = await page.request.post('/api/messages', {
      data: {
        userTo: recipientId,
        content:
          'Here is my scam link <a href="https://scammetyscammetyscam.example.com/">scammetyscammetyscam.example.com</a> <a href="/safety">Internal label</a>',
      },
    });
    expect(message.ok()).toBeTruthy();

    await page.goto(`/messages/${portland.username}`);
    const body = page.locator('.message .panel-body').filter({
      hasText: 'scammetyscammetyscam.example.com',
    });
    await expect(body).toBeVisible();
    await expect(body.locator('a')).toHaveCount(0);
    await expect(body).toContainText('Internal label');
  });

  test('direct conversation links change the recipient and clear the previous draft', async ({
    browser,
    baseURL,
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Switching directly between conversation URLs clears the previous draft and targets the new recipient.',
    ]);
    const recipient = createUser();
    const recipientContext = await createIsolatedContext(browser, baseURL);
    try {
      await registerViaApi(recipientContext.request, recipient);
      await updateUserByUsername(recipient.username, {
        $set: { public: true },
      });
    } finally {
      await recipientContext.close();
    }
    const recipientId = await fetchUserIdByUsername(
      request,
      recipient.username,
    );
    const originalRecipientId = await fetchUserIdByUsername(
      request,
      portland.username,
    );
    const conversationLabel = `Open conversation with ${recipient.username}`;
    const conversationLink = await page.request.post('/api/messages', {
      data: {
        userTo: originalRecipientId,
        content: `<a href="/messages/${recipient.username}">${conversationLabel}</a>`,
      },
    });
    expect(conversationLink.ok()).toBeTruthy();
    await page.goto(`/messages/${portland.username}`);
    const editor = page.locator('#message-reply-content');
    await expect(editor).toBeVisible();
    await editor.fill('A draft for the first conversation');
    const loadedRecipient = page.waitForResponse(
      response =>
        response.url().endsWith(`/api/users/${recipient.username}`) &&
        response.ok(),
    );
    await expect(
      page.getByText(conversationLabel, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: conversationLabel, exact: true }),
    ).toHaveCount(0);
    await page.goto(`/messages/${recipient.username}`);
    await loadedRecipient;
    await expect(editor).toBeVisible();
    await expect(editor).toHaveText('');
    const content = `A fictional conversation-switch reply ${Date.now()}`;
    await editor.fill(content);
    const sent = page.waitForResponse(
      response =>
        response.url().endsWith('/api/messages') &&
        response.request().method() === 'POST',
    );
    await page.locator('#messageReplySubmit').click();
    const response = await sent;
    expect(response.ok()).toBeTruthy();
    expect(response.request().postDataJSON().userTo).toBe(recipientId);
    await expect(page.getByText(content)).toBeVisible();
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
    const context = await createIsolatedContext(browser, baseURL);
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

      await page.goto('/search');
      const messagesLink = page.locator('#tr-header a[href="/messages"]');
      const unreadBadge = messagesLink.locator('.notification-badge');
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(unreadBadge).toBeVisible();
        const linkBounds = await messagesLink.boundingBox();
        const badgeBounds = await unreadBadge.boundingBox();
        expectPresent(linkBounds);
        expectPresent(badgeBounds);
        expect(badgeBounds.x).toBeGreaterThanOrEqual(linkBounds.x);
        expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(
          linkBounds.x + linkBounds.width,
        );
      }

      const sync = await page.request.get('/api/messages-sync');
      expect(sync.ok()).toBeTruthy();
      const syncBody = await sync.json();
      expect(syncBody.users).toEqual(expect.any(Array));
      expect(syncBody.messages).toEqual(expect.any(Object));

      const thread = await page.request.get(`/api/messages/${portland.id}`);
      expect(thread.ok()).toBeTruthy();
      const messages = (await thread.json()) as { _id: string }[];
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
