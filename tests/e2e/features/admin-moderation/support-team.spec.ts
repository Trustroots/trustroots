import fs from 'node:fs';
import path from 'node:path';
import { ObjectId } from 'mongodb';
import {
  annotateFeature,
  expect,
  expectPresent,
  test,
} from '../../support/fixtures.mts';
import {
  createUser,
  createIsolatedContext,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('support can triage a report and investigate only its verified member pair', async ({
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.support-team', [
    'Support can triage requests and inspect linked conversations and experiences without moderation authority.',
    'Support can search for a member from the top of the inbox.',
  ]);
  const context = await createIsolatedContext(browser, baseURL);
  const page = await context.newPage();
  const reporter = createUser({ firstName: 'Fictional', lastName: 'Reporter' });
  const target = createUser({ firstName: 'Fictional', lastName: 'Member' });
  const support = createUser({ firstName: 'Fictional', lastName: 'Support' });
  const supportObserver = createUser({
    firstName: 'Fictional',
    lastName: 'Observer',
  });
  let requestId: string | undefined;
  let targetId: string | undefined;
  const replyId = new ObjectId();
  try {
    for (const user of [reporter, target, support, supportObserver])
      await registerViaApi(context.request, user);
    await withE2eDb(async db => {
      const reporterDoc = (await db
        .collection('users')
        .findOne({ username: reporter.username }))!;
      const targetDoc = (await db
        .collection('users')
        .findOne({ username: target.username }))!;
      targetId = targetDoc._id.toString();
      const supportDoc = (await db
        .collection('users')
        .findOne({ username: support.username }))!;
      const observerDoc = (await db
        .collection('users')
        .findOne({ username: supportObserver.username }))!;
      await db
        .collection('users')
        .updateMany(
          { _id: { $in: [supportDoc._id, observerDoc._id] } },
          { $set: { roles: ['user', 'support-team'] } },
        );
      await db
        .collection('users')
        .updateOne(
          { _id: targetDoc._id },
          { $set: { roles: ['user', 'shadowban'], public: false } },
        );
      await db.collection('messages').insertMany([
        {
          userFrom: targetDoc._id,
          userTo: reporterDoc._id,
          content: '<p>Fictional hidden context</p>',
          created: new Date(),
          read: false,
          shadowHidden: true,
        },
        {
          userFrom: reporterDoc._id,
          userTo: targetDoc._id,
          content: '<p>Fictional reply</p>',
          created: new Date(),
          read: false,
        },
        {
          userFrom: targetDoc._id,
          userTo: supportDoc._id,
          content: '<p>Unrelated conversation</p>',
          created: new Date(),
          read: false,
        },
      ]);
      await db.collection('experiences').insertOne({
        userFrom: reporterDoc._id,
        userTo: targetDoc._id,
        created: new Date(),
        public: false,
        recommend: 'no',
        feedbackPublic: 'Fictional unpublished feedback',
      });
    });
    await signInViaApi(page, context.request, reporter);
    await page.goto(`/support?report=${target.username}`);
    await expect(
      page.getByText(/Reporting this member lets our support team read/),
    ).toBeVisible();
    const sent = await context.request.post('/api/support', {
      headers: { 'X-Trustroots-Request': '1' },
      data: {
        reportMember: target.username,
        message: 'Fictional report for support investigation.',
      },
    });
    expect(sent.ok()).toBeTruthy();
    requestId = await withE2eDb(async db => {
      const report = (await db
        .collection('supportrequests')
        .findOne({ reportMember: target.username }))!;
      expect(report.reportedUser).toBeTruthy();
      return report._id.toString();
    });
    expect((await context.request.get('/api/admin/support')).status()).toBe(
      403,
    );
    await signInViaApi(page, context.request, support);
    await page.goto('/admin/support');
    await expect(
      page.getByRole('heading', { name: 'Support inbox' }),
    ).toBeVisible();
    const memberSearch = page.getByRole('region', { name: 'Member search' });
    const requestQueue = page.getByRole('region', { name: 'Request queue' });
    const searchBox = await memberSearch.boundingBox();
    const requestQueueBox = await requestQueue.boundingBox();
    expectPresent(searchBox);
    expectPresent(requestQueueBox);
    expect(searchBox.y + searchBox.height).toBeLessThanOrEqual(
      requestQueueBox.y,
    );
    await page.getByLabel('Name, username or email').fill(target.username);
    await page.getByRole('button', { name: 'Search members' }).click();
    await expect(
      page.getByRole('link', {
        name: new RegExp(`${target.username} \\(Fictional Member\\)`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: new RegExp(`${target.username} \\(Fictional Member\\)`),
      }),
    ).toHaveAttribute(
      'href',
      `/admin/support/member/${encodeURIComponent(target.username)}`,
    );
    await page.goto(`/admin/support/member/${targetId}`);
    await expect(page).toHaveURL(
      new RegExp(`/admin/support/member/${target.username}$`),
    );
    await page.goto('/admin/support');
    await page
      .getByRole('button', {
        name: new RegExp(`${reporter.username} · Report a member`),
      })
      .click();
    await expect(
      page.getByText('Fictional report for support investigation.'),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/admin/support/requests/${requestId}$`),
    );
    await page.goBack();
    await expect(page).toHaveURL('/admin/support');
    await page.goForward();
    await expect(page).toHaveURL(
      new RegExp(`/admin/support/requests/${requestId}$`),
    );
    await page.getByLabel('Reply to requester').fill('Fictional support reply');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(
      page.getByText(/Reply could not be queued\. Your draft is still here/),
    ).toBeVisible();
    await expect(page.getByLabel('Reply to requester')).toHaveValue(
      'Fictional support reply',
    );
    await page.route(
      `**/api/admin/support/${requestId}/replies`,
      async route => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            _id: replyId.toHexString(),
            request: requestId,
            direction: 'outbound',
            kind: 'reply',
            body: 'Fictional support reply',
            createdAt: new Date().toISOString(),
            authorName: 'Fictional Support',
            deliveryState: 'captured',
          }),
        });
      },
    );
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Fictional support reply')).toBeVisible();
    await expect(
      page.getByText('Captured for testing (not sent)'),
    ).toBeVisible();
    await page.unroute(`**/api/admin/support/${requestId}/replies`);
    await withE2eDb(async db => {
      const supportDoc = (await db
        .collection('users')
        .findOne({ username: support.username }))!;
      await db.collection('supportmessages').insertOne({
        _id: replyId,
        request: new ObjectId(requestId!),
        direction: 'outbound',
        kind: 'reply',
        body: 'Fictional support reply',
        createdAt: new Date(),
        authorId: supportDoc._id,
        authorName: 'Fictional Support',
        emailFrom: 'support@example.test',
        emailTo: reporter.email,
        messageId: `<${replyId.toHexString()}@example.test>`,
        deliveryState: 'captured',
        attempts: 1,
      });
    });
    await page
      .getByLabel('Search requests')
      .fill('Fictional report for support');
    await expect(page).toHaveURL(/q=Fictional\+report\+for\+support/);
    await page.locator('#support-status').selectOption('all');
    await page.getByLabel('Category').selectOption('reportMember');
    await expect(page).toHaveURL(
      new RegExp(
        `/admin/support/requests/${requestId}\\?status=all&category=reportMember&q=Fictional\\+report\\+for\\+support$`,
      ),
    );
    await page.reload();
    await expect(page.getByText('Fictional support reply')).toBeVisible();
    const observerContext = await createIsolatedContext(browser, baseURL);
    try {
      const observerPage = await observerContext.newPage();
      await signInViaApi(
        observerPage,
        observerContext.request,
        supportObserver,
      );
      await observerPage.goto(
        `/admin/support/requests/${requestId}?status=all&category=reportMember&q=Fictional+report+for+support`,
      );
      await expect(
        observerPage.getByText('Fictional support reply'),
      ).toBeVisible();
      await expect(
        observerPage.getByText('Captured for testing (not sent)'),
      ).toBeVisible();
    } finally {
      await observerContext.close();
    }
    await page.getByRole('button', { name: 'View conversation' }).click();
    await expect(page.getByText('Fictional hidden context')).toBeVisible();
    await expect(page.getByText('Fictional reply')).toBeVisible();
    await expect(page.getByText('Unrelated conversation')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mark solved' }).click();
    await expect(
      page.getByRole('button', { name: 'Reopen request' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'View experiences' }).click();
    await expect(
      page.getByText('Fictional unpublished feedback'),
    ).toBeVisible();
    const queue = page.getByRole('region', { name: 'Request queue' });
    const details = page.getByRole('region', { name: 'Support request' });
    const queueBox = await queue.boundingBox();
    const detailsBox = await details.boundingBox();
    expect(queueBox!.x + queueBox!.width).toBeLessThan(detailsBox!.x);
    await expect(
      page.getByRole('button', { name: 'View experiences' }),
    ).toHaveAttribute('aria-pressed', 'true');
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileQueue = await queue.boundingBox();
    const mobileDetails = await details.boundingBox();
    expect(mobileDetails!.y).toBeGreaterThan(
      mobileQueue!.y + mobileQueue!.height,
    );
    expect(
      await page
        .locator('html')
        .evaluate(element => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('support-inbox-mobile.png'),
      fullPage: true,
    });
    await testInfo.attach('Support inbox mobile', {
      path: testInfo.outputPath('support-inbox-mobile.png'),
      contentType: 'image/png',
    });
    await page.setViewportSize(desktopViewport!);
    await page.screenshot({
      path: testInfo.outputPath('support-inbox.png'),
      fullPage: true,
    });
    await testInfo.attach('Support inbox', {
      path: testInfo.outputPath('support-inbox.png'),
      contentType: 'image/png',
    });
    if (process.env.TRUSTROOTS_E2E_SCREENSHOTS === 'true') {
      const screenshotsDir =
        process.env.TRUSTROOTS_E2E_SCREENSHOTS_DIR ||
        path.join(import.meta.dirname, '../../../../tmp/screenshots');
      fs.mkdirSync(screenshotsDir, { recursive: true });
      fs.copyFileSync(
        testInfo.outputPath('support-inbox.png'),
        path.join(screenshotsDir, `${testInfo.project.name}-support-inbox.png`),
      );
      fs.writeFileSync(
        path.join(screenshotsDir, `${testInfo.project.name}-support-inbox.url`),
        page.url(),
      );
    }
    await page
      .getByRole('link', { name: 'Reported account and notes' })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/support/member/${target.username}$`),
    );
    await expect(page.getByText('shadowban', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Admin user page' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Safety notes about user' }),
    ).toBeVisible();
    const noteText = `Fictional safety follow-up ${Date.now()}`;
    await page.locator('.admin-notes .tr-editor').click();
    await page.keyboard.insertText(noteText);
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(page.getByText(noteText, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(noteText, { exact: true })).toBeVisible();
    const denied = await context.request.post('/api/admin/user/change-role', {
      headers: { 'X-Trustroots-Request': '1' },
      data: { role: 'suspended', id: '111111111111111111111111' },
    });
    expect(denied.status()).toBe(403);
    expect(
      (
        await context.request.post('/api/admin/messages', {
          headers: { 'X-Trustroots-Request': '1' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    await withE2eDb(async db => {
      const reporterDoc = (await db
        .collection('users')
        .findOne({ username: reporter.username }))!;
      expect(
        await db
          .collection('messages')
          .countDocuments({ userTo: reporterDoc._id, read: false }),
      ).toBe(1);
      expect(
        await db
          .collection('auditlogs')
          .countDocuments({ 'params.requestId': requestId }),
      ).toBeGreaterThan(0);
    });
  } finally {
    await context.close();
  }
});

test('support request deep links preserve queue filters on reload', async ({
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.support-team', [
    'Support can open a request from a filterable, shareable inbox URL.',
  ]);
  const context = await createIsolatedContext(browser, baseURL);
  const page = await context.newPage();
  const support = createUser({ firstName: 'Fictional', lastName: 'Agent' });
  const requestId = new ObjectId();
  try {
    await registerViaApi(context.request, support);
    await withE2eDb(async db => {
      const supportDoc = (await db
        .collection('users')
        .findOne({ username: support.username }))!;
      await db
        .collection('users')
        .updateOne(
          { _id: supportDoc._id },
          { $set: { roles: ['user', 'support-team'] } },
        );
      await db.collection('supportrequests').insertOne({
        _id: requestId,
        category: 'other',
        sent: new Date(),
        username: 'fictional-requester',
        email: 'requester@example.test',
        message: 'Fictional deep-linked support request',
        status: 'new',
        statusRevision: 0,
      });
    });
    await signInViaApi(page, context.request, support);
    await page.goto(
      `/admin/support/requests/${requestId.toHexString()}?status=new&category=other&q=deep-linked`,
    );
    await expect(
      page.getByText('Fictional deep-linked support request'),
    ).toBeVisible();
    await expect(
      page.getByText(/^Showing 1–1 of 1 matching requests \(\d+ total\)$/),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(
        `/admin/support/requests/${requestId.toHexString()}\\?status=new&category=other&q=deep-linked$`,
      ),
    );
    await page.reload();
    await expect(
      page.getByText('Fictional deep-linked support request'),
    ).toBeVisible();
    await expect(page.locator('#support-status')).toHaveValue('new');
    await expect(page.locator('#support-category')).toHaveValue('other');
    await expect(page.getByLabel('Search requests')).toHaveValue('deep-linked');
  } finally {
    await context.close();
  }
});

test('administrators can see why a historical status was skipped during matching', async ({
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.support-team', [
    'Administrators can preview historical support statuses and see why unmatched tickets remain unchanged.',
  ]);
  const context = await createIsolatedContext(browser, baseURL);
  const page = await context.newPage();
  const administrator = createUser({
    firstName: 'Fictional',
    lastName: 'Administrator',
  });
  try {
    await registerViaApi(context.request, administrator);
    await withE2eDb(async db => {
      await db
        .collection('users')
        .updateOne(
          { username: administrator.username },
          { $set: { roles: ['user', 'admin'] } },
        );
    });
    await signInViaApi(page, context.request, administrator);
    await page.goto('/admin/support');
    const importer = page.getByRole('region', {
      name: 'Zendesk status import',
    });
    await importer.getByLabel('Reduced JSON manifest').setInputFiles({
      name: 'fictional-statuses.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          exportedAt: '2025-01-01T00:00:00.000Z',
          items: [
            {
              zendeskTicketId: 987654,
              status: 'closed',
              updatedAt: '2025-01-01T00:00:00.000Z',
              fingerprint: '0'.repeat(64),
            },
          ],
        }),
      ),
    });
    await importer
      .getByRole('button', { name: 'Preview status changes' })
      .click();
    await expect(
      importer.getByText(/0 eligible, 0 already applied, 1 skipped/),
    ).toBeVisible();
    const breakdown = importer.getByRole('table', {
      name: 'Skipped during matching',
    });
    await expect(
      breakdown.getByText(
        'No local request matches the original category, email and message',
      ),
    ).toBeVisible();
    await expect(
      breakdown.getByRole('cell', { name: '1', exact: true }),
    ).toBeVisible();
    await expect(
      importer.getByRole('button', { name: 'Apply status changes' }),
    ).toBeDisabled();
    await withE2eDb(async db => {
      expect(
        await db
          .collection('supportrequests')
          .countDocuments({ zendeskTicketId: 987654 }),
      ).toBe(0);
    });
  } finally {
    await context.close();
  }
});
