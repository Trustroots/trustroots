const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  fetchUserIdByUsername,
  signInViaApi,
} = require('../../support/helpers');

test.describe('admin newsletter API feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  async function setNewsletterPreference(page, request, member, newsletter) {
    await signInViaApi(page, request, member);
    const response = await request.put('/api/users', {
      data: { newsletter },
    });
    expect(response.ok()).toBeTruthy();
  }

  test('admin can split newsletter recipients from uploaded NDJSON', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-downloads', [
      'Admin can upload a newsletter NDJSON file and split recipients by subscription status.',
      'Split downloads preserve the uploaded recipient-list format.',
    ]);
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter page includes the recipient upload splitting tool.',
    ]);

    await setNewsletterPreference(page, request, SEEDED_MEMBERS[0], true);
    await setNewsletterPreference(page, request, SEEDED_MEMBERS[1], false);
    await signInViaApi(page, request, SEEDED_ADMIN);

    await page.goto('/admin/newsletter');
    await expect(
      page.getByLabel('Recipient file (CSV, JSONL, or NDJSON)'),
    ).toBeVisible();

    await page.locator('#newsletter-recipient-file').setInputFiles({
      buffer: Buffer.from(
        [
          JSON.stringify({ email: SEEDED_MEMBERS[0].email }),
          JSON.stringify({ email: SEEDED_MEMBERS[1].email }),
          JSON.stringify({ email: 'missing@example.test' }),
        ].join('\n'),
      ),
      mimeType: 'application/x-ndjson',
      name: 'newsletter.ndjson',
    });

    await page.getByRole('button', { name: 'Check recipients' }).click();

    await expect(
      page.getByText('Processed 3 emails: 1 eligible and 2 excluded.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download eligible NDJSON' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download excluded NDJSON' }),
    ).toBeVisible();

    const [eligibleDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download eligible NDJSON' }).click(),
    ]);
    expect(eligibleDownload.suggestedFilename()).toBe(
      'newsletter-eligible.ndjson',
    );
    const eligibleStream = await eligibleDownload.createReadStream();
    let eligibleText = '';
    for await (const chunk of eligibleStream) {
      eligibleText += chunk.toString();
    }
    expect(JSON.parse(eligibleText).email).toBe(SEEDED_MEMBERS[0].email);

    const [excludedDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download excluded NDJSON' }).click(),
    ]);
    expect(excludedDownload.suggestedFilename()).toBe(
      'newsletter-excluded.ndjson',
    );
  });

  test('admin can export all and circle subscriber CSVs', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-downloads', [
      'Admin can export all eligible subscribers as CSV.',
      'Admin can export eligible subscribers for a specific circle.',
      'Restricted-role members are excluded from eligible newsletter exports.',
    ]);
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter page includes full and circle subscriber export tools.',
    ]);

    await setNewsletterPreference(page, request, SEEDED_MEMBERS[0], true);
    await setNewsletterPreference(page, request, SEEDED_MEMBERS[1], false);
    await setNewsletterPreference(page, request, SEEDED_MEMBERS[2], true);
    await signInViaApi(page, request, SEEDED_ADMIN);

    const shadowbanTargetId = await fetchUserIdByUsername(
      request,
      SEEDED_MEMBERS[2].username,
    );
    const shadowbanResponse = await request.post(
      '/api/admin/user/change-role',
      {
        data: { id: shadowbanTargetId, role: 'shadowban' },
      },
    );
    expect(shadowbanResponse.ok()).toBeTruthy();

    const allExport = await request.get('/api/admin/newsletter-subscribers');
    expect(allExport.ok()).toBeTruthy();
    expect(allExport.headers()['content-type']).toContain('text/csv');
    const allExportText = await allExport.text();
    expect(allExportText).toContain(SEEDED_MEMBERS[0].email);
    expect(allExportText).not.toContain(SEEDED_MEMBERS[1].email);
    expect(allExportText).not.toContain(SEEDED_MEMBERS[2].email);

    const member0Id = await fetchUserIdByUsername(
      request,
      SEEDED_MEMBERS[0].username,
    );
    const memberReport = await request.post('/api/admin/user', {
      data: { id: member0Id },
    });
    expect(memberReport.ok()).toBeTruthy();
    const reportBody = await memberReport.json();
    const circleId = reportBody?.profile?.member?.[0]?.tribe?._id;
    expect(Boolean(circleId)).toBeTruthy();

    const circleExport = await request.get(
      `/api/admin/newsletter-subscribers/circle?circleId=${circleId}`,
    );
    expect(circleExport.ok()).toBeTruthy();
    expect(circleExport.headers()['content-type']).toContain('text/csv');
    const circleExportText = await circleExport.text();
    expect(circleExportText).toContain(SEEDED_MEMBERS[0].email);
    expect(circleExportText).not.toContain(SEEDED_MEMBERS[1].email);
    expect(circleExportText).not.toContain(SEEDED_MEMBERS[2].email);
  });

  test('admin can build a location and circle newsletter audience', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-audiences', [
      'Admin can combine selected location sources with selected circles.',
      'Admin can preview and export the eligible targeted audience.',
      'Audience counts refresh automatically after valid filters change.',
    ]);
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter page includes the targeted audience builder.',
    ]);

    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    const updateResponse = await request.put('/api/users', {
      data: {
        locationLiving: 'Northbridge, Exampleland',
        newsletter: true,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
    await signInViaApi(page, request, SEEDED_ADMIN);

    const memberId = await fetchUserIdByUsername(
      request,
      SEEDED_MEMBERS[0].username,
    );
    const memberReport = await request.post('/api/admin/user', {
      data: { id: memberId },
    });
    const reportBody = await memberReport.json();
    const circleId = reportBody?.profile?.member?.[0]?.tribe?._id;
    expect(Boolean(circleId)).toBeTruthy();

    await page.goto('/admin/newsletter');
    await page.getByLabel('Hosting location').uncheck();
    await page.getByLabel('Location name').fill('Northbridge');
    await page.getByLabel('Circles (optional)').selectOption(circleId);
    await expect(
      page.getByText('1 eligible recipient matches these filters.'),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export audience CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('newsletter-audience.csv');
  });
});
