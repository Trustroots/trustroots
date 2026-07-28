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

  test('admin can split newsletter recipients from uploaded CSV', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-downloads', [
      'Admin can upload a newsletter CSV and split recipients by subscription status.',
      'Split response includes downloadable subscribed and unsubscribed CSV files.',
    ]);
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter page includes the CSV upload splitting tool.',
    ]);

    await setNewsletterPreference(page, request, SEEDED_MEMBERS[0], true);
    await setNewsletterPreference(page, request, SEEDED_MEMBERS[1], false);
    await signInViaApi(page, request, SEEDED_ADMIN);

    await page.goto('/admin/newsletter');
    await expect(page.getByLabel('Newsletter CSV file')).toBeVisible();

    await page.locator('#newsletter-csv-file').setInputFiles({
      buffer: Buffer.from(
        [
          'Email Address',
          SEEDED_MEMBERS[0].email,
          SEEDED_MEMBERS[1].email,
          'missing@example.test',
        ].join('\n'),
      ),
      mimeType: 'text/csv',
      name: 'newsletter.csv',
    });

    await page.getByRole('button', { name: 'Split recipients' }).click();

    await expect(
      page.getByText(
        'Processed 3 emails: 1 still subscribed and 2 unsubscribed.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download still subscribed CSV' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download unsubscribed CSV' }),
    ).toBeVisible();
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
});
