const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
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
});
