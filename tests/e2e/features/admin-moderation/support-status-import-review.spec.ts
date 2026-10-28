import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('administrators explicitly choose one suggested request before applying a status', async ({
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.support-team', [
    'Administrators review competing historical status candidates and explicitly select one before applying.',
  ]);
  const context = await createIsolatedContext(browser, baseURL);
  const page = await context.newPage();
  const administrator = createUser({
    firstName: 'Fictional',
    lastName: 'Administrator',
  });
  let applyBody: unknown;
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
    await page.route('**/api/admin/support-import/preview', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          previewId: 'fictional-preview',
          counts: {
            total: 1,
            eligible: 0,
            suggested: 1,
            alreadyApplied: 0,
            skipped: 1,
            skippedByReason: {},
          },
          changes: [],
          matchReviews: [
            {
              zendeskTicketId: 987654,
              category: 'other',
              submittedAt: '2025-01-01T00:00:00.000Z',
              importedStatus: 'pending',
              candidates: [
                {
                  requestId: '111111111111111111111111',
                  category: 'other',
                  submittedAt: '2025-01-01T00:00:10.000Z',
                  matchKind: 'suggested',
                  reason:
                    'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
                  timeDifferenceSeconds: 10,
                  competingCandidateCount: 2,
                  currentStatus: 'open',
                  importedStatus: 'pending',
                },
                {
                  requestId: '222222222222222222222222',
                  category: 'other',
                  submittedAt: '2025-01-01T00:00:20.000Z',
                  matchKind: 'suggested',
                  reason:
                    'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
                  timeDifferenceSeconds: 20,
                  competingCandidateCount: 2,
                  currentStatus: 'new',
                  importedStatus: 'pending',
                },
              ],
            },
          ],
          expiresAt: '2025-01-01T00:30:00.000Z',
        }),
      }),
    );
    await page.route('**/api/admin/support-import/apply', async route => {
      applyBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ applied: 1, alreadyApplied: 0, skipped: 0 }),
      });
    });
    await page.goto('/admin/support');
    const importer = page.getByRole('region', {
      name: 'Zendesk status import',
    });
    await importer.getByLabel('Reduced JSON manifest').setInputFiles({
      name: 'fictional-statuses-v2.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          version: 2,
          exportedAt: '2025-01-01T00:00:00.000Z',
          items: [
            {
              zendeskTicketId: 987654,
              status: 'pending',
              updatedAt: '2025-01-01T00:00:00.000Z',
              fingerprint: 'a'.repeat(64),
              evidence: {
                senderHash: 'b'.repeat(64),
                category: 'other',
                submittedAt: '2025-01-01T00:00:00.000Z',
                normalisedMessageHash: 'c'.repeat(64),
              },
            },
          ],
        }),
      ),
    });
    await importer
      .getByRole('button', { name: 'Preview status changes' })
      .click();
    await expect(
      importer.getByRole('heading', {
        name: 'Suggested matches need your review',
      }),
    ).toBeVisible();
    await expect(
      importer.getByRole('link', { name: 'Request 111111111111111111111111' }),
    ).toHaveAttribute(
      'href',
      '/admin/support/requests/111111111111111111111111',
    );
    const apply = importer.getByRole('button', {
      name: 'Apply status changes',
    });
    await expect(apply).toBeDisabled();
    const selected = importer.getByRole('checkbox', {
      name: /Request 222222222222222222222222/,
    });
    await selected.check();
    await apply.click();
    await expect(
      importer.getByText(/Applied 1; already applied 0; skipped 0/),
    ).toBeVisible();
    expect(applyBody).toEqual({
      previewId: 'fictional-preview',
      selectedMatches: [
        { zendeskTicketId: 987654, requestId: '222222222222222222222222' },
      ],
    });
  } finally {
    await context.close();
  }
});
