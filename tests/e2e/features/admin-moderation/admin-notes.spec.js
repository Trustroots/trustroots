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

  test('admin can add a note from the member report page', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.notes', [
      'Existing admin notes load for a user.',
      'Admin can add a note and see it persisted.',
    ]);
    annotateFeature(testInfo, 'admin.user-report', [
      'Admin user report card loads for a member id.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);
    const noteText = `E2E admin UI note ${Date.now()}`;

    await page.goto(`/admin/user?id=${shadowId}`);
    await expect(
      page.getByRole('heading', {
        name: `${SEEDED_SHADOW.firstName} ${SEEDED_SHADOW.lastName} report card`,
      }),
    ).toBeVisible();
    await expect(page.getByText('Admin notes about user')).toBeVisible();

    const editor = page.locator('.admin-notes .tr-editor');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.insertText(noteText);

    const addNote = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/notes') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /^save note$/i }).click();
    await addNote;

    await expect(page.getByText(noteText)).toBeVisible();
  });
});
