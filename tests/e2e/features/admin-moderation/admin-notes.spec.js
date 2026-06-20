const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_SHADOW,
  signInViaApi,
} = require('../../support/helpers');
const { findUserByUsername } = require('../../support/db');

test.describe('admin notes feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin notes can be read and added', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.notes', [
      'Existing admin notes load for a user.',
      'Admin can add a note and see it persisted.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);

    const existing = await page.request.get('/api/admin/notes', {
      params: { userId: shadowId },
    });
    expect(existing.ok()).toBeTruthy();
    expect((await existing.json()).length).toBeGreaterThan(0);

    const noteText = `E2E admin note ${Date.now()}`;
    const add = await page.request.post('/api/admin/notes', {
      data: {
        userId: shadowId,
        note: noteText,
      },
    });
    expect(add.ok()).toBeTruthy();

    const updated = await page.request.get('/api/admin/notes', {
      params: { userId: shadowId },
    });
    expect(
      (await updated.json()).some(note => note.note.includes(noteText)),
    ).toBe(true);
  });
});
