import fs from 'node:fs';
import path from 'node:path';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';
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
  let requestId: string | undefined;
  try {
    for (const user of [reporter, target, support])
      await registerViaApi(context.request, user);
    await withE2eDb(async db => {
      const reporterDoc = (await db
        .collection('users')
        .findOne({ username: reporter.username }))!;
      const targetDoc = (await db
        .collection('users')
        .findOne({ username: target.username }))!;
      const supportDoc = (await db
        .collection('users')
        .findOne({ username: support.username }))!;
      await db
        .collection('users')
        .updateOne(
          { _id: supportDoc._id },
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
    await page
      .getByRole('button', {
        name: new RegExp(`${reporter.username} · Report a member`),
      })
      .click();
    await expect(
      page.getByText('Fictional report for support investigation.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'View conversation' }).click();
    await expect(page.getByText('Fictional hidden context')).toBeVisible();
    await expect(page.getByText('Fictional reply')).toBeVisible();
    await expect(page.getByText('Unrelated conversation')).toHaveCount(0);
    await page.getByRole('button', { name: 'Resolve request' }).click();
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
    }
    await page
      .getByRole('link', { name: 'Reported account and notes' })
      .click();
    await expect(page.getByText('shadowban', { exact: true })).toBeVisible();
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
