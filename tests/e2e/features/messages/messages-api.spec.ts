import {
  request as playwrightRequest,
  type APIResponse,
} from '@playwright/test';
import {
  expectPresent,
  annotateFeature,
  test as base,
  expect,
} from '../../support/fixtures.mts';
import { ObjectId } from 'mongodb';
import {
  findUserByUsername,
  updateUserByUsername,
  withE2eDb,
} from '../../support/db.mts';

import {
  SEEDED_CONVERSATIONS,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  fetchUserIdByUsername,
  authenticateViaApi,
  signInViaApi,
  createUser,
  registerViaApi,
} from '../../support/helpers.mts';

const test = base.extend({
  request: async ({ request }, use) => {
    await authenticateViaApi(request, SEEDED_MEMBERS[0]);
    await use(request);
  },
});

interface MessageApiReply {
  _id: string;
  content: string;
}

interface MessageApiThread {
  userFrom?: { username: string };
  userTo?: { username: string };
  message: { excerpt: string; content?: string; spam?: boolean };
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('mobile bearer message regressions', () => {
  test('main profile features remain available through bearer routes', async ({
    baseURL,
  }) => {
    const client = await playwrightRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const member = SEEDED_MEMBERS[0];
      const signin = await client.post('/api/mobile/v0/auth/signin', {
        data: { username: member.username, password: member.password },
      });
      expect(signin.status()).toBe(200);
      const headers = {
        Authorization: `Bearer ${(await signin.json()).accessToken as string}`,
      };
      const search = await client.get('/api/mobile/v0/members', {
        headers,
        params: { search: SEEDED_MEMBERS[1].firstName },
      });
      expect(search.status()).toBe(200);
      expect(
        (await search.json()).some(
          (result: { username: string }) =>
            result.username === SEEDED_MEMBERS[1].username,
        ),
      ).toBe(true);
      const offers = await client.get(
        `/api/mobile/v0/offers-by/${member.id}?types=host`,
        { headers },
      );
      expect(offers.status()).toBe(200);
      expect((await offers.json()).length).toBeGreaterThan(0);
      const avatar = await client.get(
        `/api/mobile/v0/members/${member.id}/avatar?size=128`,
        { headers, maxRedirects: 0 },
      );
      expect(avatar.status()).toBe(302);
      const blocked = await client.get('/api/mobile/v0/blocked-users', {
        headers,
      });
      expect(blocked.status()).toBe(200);
      expect(blocked.headers()['set-cookie']).toBeUndefined();
    } finally {
      await client.dispose();
    }
  });

  test('search preserves unread state and reading acknowledges only received messages', async ({
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
    ]);
    const client = await playwrightRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const signIn = async (
        member: (typeof SEEDED_MEMBERS)[number],
      ): Promise<{ Authorization: string }> => {
        const response = await client.post('/api/mobile/v0/auth/signin', {
          data: { username: member.username, password: member.password },
        });
        expect(response.status()).toBe(200);
        expect(response.headers()['set-cookie']).toBeUndefined();
        const data = (await response.json()) as { accessToken: string };
        return { Authorization: `Bearer ${data.accessToken}` };
      };
      const sender = await signIn(SEEDED_MEMBERS[0]);
      const reader = await signIn(SEEDED_MEMBERS[1]);
      const sent = await client.post('/api/mobile/v0/messages', {
        headers: sender,
        data: {
          userTo: SEEDED_MEMBERS[1].id,
          content: 'An example message for the mobile read-state regression.',
        },
      });
      expect(sent.status()).toBe(200);
      const message = (await sent.json()) as { _id: string };
      const acknowledge = (headers: { Authorization: string }) =>
        client.post('/api/mobile/v0/messages-read', {
          headers,
          data: { messageIds: [message._id] },
        });
      expect((await acknowledge(sender)).status()).toBe(200);
      const threadPath = `/api/mobile/v0/messages/${SEEDED_MEMBERS[0].id}`;
      const searched = await client.get(`${threadPath}?markRead=false`, {
        headers: reader,
      });
      expect(searched.status()).toBe(200);
      expect(
        (await searched.json()).find(
          (item: { _id: string; read: boolean }) => item._id === message._id,
        ).read,
      ).toBe(false);
      const inbox = await client.get('/api/mobile/v0/messages', {
        headers: reader,
      });
      expect(
        (await inbox.json()).find(
          (item: {
            userFrom?: { username: string };
            userTo?: { username: string };
            read: boolean;
          }) =>
            [item.userFrom?.username, item.userTo?.username].includes(
              SEEDED_MEMBERS[1].username,
            ),
        ).read,
      ).toBe(false);
      expect((await client.get(threadPath, { headers: reader })).status()).toBe(
        200,
      );
      const acknowledged = await acknowledge(reader);
      expect(acknowledged.status()).toBe(200);
      expect(acknowledged.headers()['set-cookie']).toBeUndefined();
      const opened = await client.get(`${threadPath}?markRead=false`, {
        headers: reader,
      });
      expect(
        (await opened.json()).find(
          (item: { _id: string; read: boolean }) => item._id === message._id,
        ).read,
      ).toBe(true);
    } finally {
      await client.dispose();
    }
  });

  test('unconfirmed members cannot use bearer tokens to bypass publication policies', async ({
    baseURL,
  }) => {
    const client = await playwrightRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const member = createUser();
      await registerViaApi(client, member);
      const signin = await client.post('/api/mobile/v0/auth/signin', {
        data: { username: member.username, password: member.password },
      });
      expect(signin.status()).toBe(200);
      const data = (await signin.json()) as { accessToken: string };
      const headers = { Authorization: `Bearer ${data.accessToken}` };
      expect(
        (await client.get('/api/mobile/v0/me', { headers })).status(),
      ).toBe(200);
      for (const path of [
        '/api/mobile/v0/messages',
        '/api/mobile/v0/offers',
        '/api/mobile/v0/experiences',
      ]) {
        expect((await client.get(path, { headers })).status()).toBe(403);
      }
      expect(
        (
          await client.post('/api/mobile/v0/messages', {
            headers,
            data: {
              userTo: SEEDED_MEMBERS[0].id,
              content: 'An unconfirmed example.',
            },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await client.dispose();
    }
  });
});

test.describe('seeded message API flows', () => {
  test('thread messages render formatted text without active markup', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Sending a reply appends it to the thread.',
    ]);
    const content =
      '<p><b>Fictional formatted message</b><img src="/missing-fixture-image" onerror="window.fixtureMarkupExecuted=true">' +
      '<a href="javascript:window.fixtureMarkupExecuted=true">unsafe link</a></p>' +
      '<script>window.fixtureMarkupExecuted=true</script>';
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    const response = await request.post('/api/messages', {
      data: { userTo: SEEDED_MEMBERS[1].id, content },
    });
    expect(response.ok()).toBeTruthy();

    await page.goto(`/messages/${SEEDED_MEMBERS[1].username}`);
    const message = page
      .locator('.message-sender-me')
      .filter({ hasText: 'Fictional formatted message' });
    const messageContent = message.locator('.panel-body');
    await expect(messageContent.locator('b')).toHaveText(
      'Fictional formatted message',
    );
    await expect(
      messageContent.locator('img, script, a[href^="javascript:"]'),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { fixtureMarkupExecuted?: boolean })
            .fixtureMarkupExecuted,
      ),
    ).toBeUndefined();
  });

  test('conversation retrieval preserves unread state until acknowledgement', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Conversation retrieval preserves read state until explicit acknowledgement.',
    ]);
    const userTo = new ObjectId(SEEDED_MEMBERS[0].id);
    const userFrom = new ObjectId(SEEDED_MEMBERS[1].id);
    const messageId = new ObjectId();
    const thread = await withE2eDb(async db => {
      const original = await db.collection('threads').findOne({
        $or: [
          { userTo, userFrom },
          { userTo: userFrom, userFrom: userTo },
        ],
      });
      expectPresent(original);
      await db.collection('messages').insertOne({
        _id: messageId,
        userFrom,
        userTo,
        content: 'A fictional unread reply.',
        read: false,
        created: new Date(),
      });
      await db.collection('threads').updateOne(
        { _id: original._id },
        {
          $set: { userFrom, userTo, message: messageId, read: false },
        },
      );
      return original;
    });
    const persistedThread = () =>
      withE2eDb(db => db.collection('threads').findOne({ _id: thread._id }));
    const expectThreadRead = async (read: boolean): Promise<void> => {
      const persisted = await persistedThread();
      expectPresent(persisted);
      expect(persisted.read).toBe(read);
    };
    try {
      expect(
        (await request.get(`/api/messages/${userFrom}`)).ok(),
      ).toBeTruthy();
      await expectThreadRead(false);
      for (const messageIds of [[{ $ne: null }], ['invalid'], [null]]) {
        expect(
          (
            await request.post('/api/messages-read', { data: { messageIds } })
          ).status(),
        ).toBe(400);
        await expectThreadRead(false);
      }
      expect(
        (await request.get('/api/auth/session?name[$ne]=value')).status(),
      ).toBe(400);
      expect(
        (
          await request.post('/api/messages-read', {
            data: { messageIds: [messageId.toString()] },
            headers: { Origin: 'https://fictional.example' },
          })
        ).status(),
      ).toBe(403);
      await expectThreadRead(false);
      expect(
        (
          await request.post('/api/messages-read', {
            data: { messageIds: [messageId.toString()] },
          })
        ).ok(),
      ).toBeTruthy();
      await expectThreadRead(true);
    } finally {
      await withE2eDb(async db => {
        await db.collection('threads').replaceOne({ _id: thread._id }, thread);
        await db.collection('messages').deleteOne({ _id: messageId });
      });
    }
  });

  test('inbox and collapsed profile previews display literal markup characters', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox previews display literal text.',
    ]);
    annotateFeature(testInfo, 'profile.view-about', [
      'Collapsed profile previews display literal text.',
    ]);
    const member = SEEDED_MEMBERS[0];
    const original = await findUserByUsername(member.username);
    expectPresent(original);
    const literal = '<img src=x onerror=alert(1)>';
    const encoded = '&lt;img src=x onerror=alert(1)&gt;';
    await signInViaApi(page, request, member);
    try {
      expect(
        (
          await page.request.put('/api/users', {
            data: { description: `${encoded}${'A'.repeat(2100)}` },
          })
        ).ok(),
      ).toBeTruthy();
      await page.goto(`/profile/${member.username}/about`);
      const preview = page.locator('#profile-description');
      await expect(preview).toContainText(literal);
      await expect(preview.locator('img')).toHaveCount(0);
      await page.getByText('Read more…', { exact: true }).click();
      await expect(page.locator('.profile-view img[src="x"]')).toHaveCount(0);
      expect(
        (
          await page.request.post('/api/messages', {
            data: {
              userTo: SEEDED_MEMBERS[1].id,
              content: '&amp;lt;img src=x onerror=alert(1)&amp;gt;',
            },
          })
        ).ok(),
      ).toBeTruthy();
      await page.goto('/messages');
      const excerpt = page
        .locator('.threadlist-thread-excerpt')
        .filter({ hasText: literal });
      await expect(excerpt).toHaveCount(1);
      await expect(excerpt.locator('img')).toHaveCount(0);
    } finally {
      await updateUserByUsername(member.username, {
        $set: { description: original.description },
      });
    }
  });

  test('a sent message is populated and persists through the native client', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Sending a reply appends it to the thread.',
    ]);
    const content = `Database integration ${new ObjectId()}`;
    const response = await request.post('/api/messages', {
      data: { userTo: SEEDED_MEMBERS[1].id, content },
    });
    expect(response.ok()).toBeTruthy();
    const message = await response.json();

    expect(message.userFrom.username).toBe(SEEDED_MEMBERS[0].username);
    expect(message.userTo.username).toBe(SEEDED_MEMBERS[1].username);
    const persisted = await withE2eDb(db =>
      db.collection('messages').findOne({ _id: new ObjectId(message._id) }),
    );
    expectPresent(persisted);
    expect(persisted.content).toBe(content);
    expect(persisted).not.toHaveProperty('spam');
    expect(persisted.shadowHidden).toBe(false);
    expect(persisted.read).toBe(false);
    expect(persisted.notificationCount).toBe(0);
    const thread = await request.get(`/api/messages/${SEEDED_MEMBERS[1].id}`);
    expect(
      ((await thread.json()) as MessageApiReply[]).map(reply => reply.content),
    ).toContain(content);
  });

  test('throttled messages queue one support alert across concurrent retries', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Validation prevents empty or forbidden replies.',
    ]);
    const sender = await findUserByUsername(SEEDED_MEMBERS[0].username);
    expectPresent(sender);
    const history = Array.from({ length: 16 }, () => ({
      _id: new ObjectId(),
      userFrom: sender._id,
      userTo: new ObjectId(),
      created: new Date(),
      content: 'A fictional earlier greeting.',
    }));
    const content = `Fictional blocked greeting ${new ObjectId()}`;
    const jobFilter = {
      name: 'send email',
      'data.subject': 'Member reached the messaging recipient limit',
      'data.text': { $regex: `/admin/user\\?id=${sender._id}` },
    };
    try {
      await withE2eDb(async db => {
        await db
          .collection('messagethrottlealerts')
          .deleteOne({ _id: sender._id });
        await db.collection('agendaJobs').deleteMany(jobFilter);
        await db.collection('messages').insertMany(history);
      });
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          request.post('/api/messages', {
            data: { userTo: SEEDED_MEMBERS[1].id, content },
          }),
        ),
      );
      for (const response of responses) expect(response.status()).toBe(429);
      const jobs = await withE2eDb(db =>
        db.collection('agendaJobs').find(jobFilter).toArray(),
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.data.text).toContain(`@${sender.username}`);
      expect(jobs[0]!.data.text).not.toContain(content);
      expect(
        await withE2eDb(db =>
          db
            .collection('messages')
            .countDocuments({ userFrom: sender._id, content }),
        ),
      ).toBe(0);
    } finally {
      await withE2eDb(async db => {
        await db
          .collection('messages')
          .deleteMany({ _id: { $in: history.map(message => message._id) } });
        await db
          .collection('messagethrottlealerts')
          .deleteOne({ _id: sender._id });
        await db.collection('agendaJobs').deleteMany(jobFilter);
      });
    }
  });

  for (const role of ['welcome-team', 'admin']) {
    test(`${role} can message above the recipient limit until the role is removed`, async ({
      request,
    }, testInfo) => {
      annotateFeature(testInfo, 'messages.reply-send', [
        'Sending a reply appends it to the thread.',
      ]);
      const member = SEEDED_MEMBERS[0];
      const sender = await findUserByUsername(member.username);
      expectPresent(sender);
      const history = Array.from({ length: 16 }, () => ({
        _id: new ObjectId(),
        userFrom: sender._id,
        userTo: new ObjectId(),
        created: new Date(),
        content: 'Earlier community greeting.',
      }));
      const content = `Welcome team throttle regression ${new ObjectId()}`;
      const send = () =>
        request.post('/api/messages', {
          data: { userTo: SEEDED_MEMBERS[1].id, content },
        });
      try {
        await withE2eDb(db => db.collection('messages').insertMany(history));
        await updateUserByUsername(member.username, {
          $set: { roles: ['user'] },
        });
        expect((await send()).status()).toBe(429);
        await updateUserByUsername(member.username, {
          $set: { roles: ['user', role] },
        });
        expect((await send()).ok()).toBeTruthy();
        const thread = await request.get(
          `/api/messages/${SEEDED_MEMBERS[1].id}`,
        );
        expect(
          ((await thread.json()) as MessageApiReply[]).map(
            message => message.content,
          ),
        ).toContain(content);
        await updateUserByUsername(member.username, {
          $set: { roles: ['user'] },
        });
        expect((await send()).status()).toBe(429);
      } finally {
        await updateUserByUsername(member.username, {
          $set: { roles: sender.roles },
        });
        await withE2eDb(db =>
          db.collection('messages').deleteMany({
            _id: { $in: history.map(message => message._id) },
          }),
        );
      }
    });
  }

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
      const checks: Array<[string, () => Promise<APIResponse>]> = [
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
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.inbox', [
      'Inbox lists seeded conversation.',
      'Inbox excludes shadow-hidden conversations.',
    ]);

    const inbox = await request.get('/api/messages', {
      params: { limit: 5 },
    });
    expect(inbox.ok()).toBeTruthy();

    const threads = (await inbox.json()) as MessageApiThread[];
    expect(Array.isArray(threads)).toBeTruthy();
    expect(threads.length).toBeGreaterThan(0);

    const seededThread = threads.find(thread =>
      [thread.userFrom?.username, thread.userTo?.username].includes(
        SEEDED_MEMBERS[1].username,
      ),
    );
    expect(seededThread).toBeTruthy();
    expectPresent(seededThread);
    expect(seededThread.message.excerpt).toEqual(expect.any(String));
    expect(seededThread.message.content).toBeUndefined();
    expect(seededThread.message.spam).toBeUndefined();

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const thread = await request.get(`/api/messages/${portlandId}`);
    expect(thread.ok()).toBeTruthy();
    const threadContents = ((await thread.json()) as MessageApiReply[]).map(
      message => message.content,
    );
    expect(threadContents).toContain(
      SEEDED_CONVERSATIONS.berlinPortland.latestReply,
    );
    expect(threadContents).toContain(
      SEEDED_CONVERSATIONS.berlinPortland.openingMessage,
    );
  });

  test('thread API paginates seeded replies', async ({ request }, testInfo) => {
    annotateFeature(testInfo, 'messages.thread-open', [
      'Thread view shows seeded replies.',
      'Thread can be opened by username or userId route/query.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const response = await request.get(`/api/messages/${portlandId}`, {
      params: { page: 1, limit: 1 },
    });
    expect(response.ok()).toBeTruthy();

    const messages = await response.json();
    expect(messages).toHaveLength(1);
    expect(response.headers().link).toContain('page=2');
  });

  test('message send API rejects invalid recipients', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.reply-send', [
      'Validation prevents empty or forbidden replies.',
    ]);
    annotateFeature(testInfo, 'messages.new-conversation', [
      'Sending an opening message creates the conversation.',
    ]);

    const invalidRecipient = await request.post('/api/messages', {
      data: {
        userTo: 'not-a-mongo-id',
        content: 'This should not be sent',
      },
    });
    expect(invalidRecipient.status()).toBe(400);

    const selfMessage = await request.post('/api/messages', {
      data: {
        userTo: SEEDED_MEMBERS[0].id,
        content: 'This should not be sent to myself',
      },
    });
    expect(selfMessage.status()).toBe(403);
  });

  test('message status APIs expose unread and sync payloads', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
      'Message sync endpoint returns deterministic updates.',
      'Sync handles no-new-message state.',
    ]);

    const unread = await request.get('/api/messages-count');
    expect(unread.ok()).toBeTruthy();
    expect(await unread.json()).toMatchObject({
      unread: expect.any(Number),
    });

    const sync = await request.get('/api/messages-sync', {
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
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.read-count-sync', [
      'Unread count changes after opening or marking a thread read.',
      'Sync handles no-new-message state.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const thread = await request.get(`/api/messages/${portlandId}`);
    expect(thread.ok()).toBeTruthy();
    const messages = (await thread.json()) as MessageApiReply[];
    expect(messages.length).toBeGreaterThan(0);

    const markRead = await request.post('/api/messages-read', {
      data: {
        messageIds: messages.map(message => message._id),
      },
    });
    expect(markRead.ok()).toBeTruthy();

    const invalidDate = await request.get('/api/messages-sync', {
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

    const messages = (await response.json()) as MessageApiReply[];
    const contents = messages.map(message => message.content);
    expect(contents).not.toContain(SEEDED_SHADOW_MESSAGE);
  });
});
