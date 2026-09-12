const { expect, test } = require('../../support/test');
const {
  SEEDED_RELATIONSHIP_MEMBERS,
  signInViaApi,
} = require('../../support/helpers');
const { findContactByUsers, withE2eDb } = require('../../support/db');

test('contact confirmation retains guest and missing-request behaviour', async ({
  page,
}) => {
  await page.goto('/contact-confirm/665000000000000000000090');
  await expect(page).toHaveURL(/\/signin$/);
  await signInViaApi(page, undefined, SEEDED_RELATIONSHIP_MEMBERS.alice);
  await page.goto('/contact-confirm/665000000000000000000090');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.getByText(/Could not find contact request/)).toBeVisible();
});

test('recipient can confirm a pending contact and reopen the result', async ({
  page,
}) => {
  const { alice, bob } = SEEDED_RELATIONSHIP_MEMBERS;
  const contact = await findContactByUsers(bob.id, alice.id);
  expect(contact).toBeTruthy();
  try {
    await signInViaApi(page, undefined, alice);
    await page.goto(`/contact-confirm/${contact._id}`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm contact' }).click();
    await expect(page.getByText('You two are now connected!')).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('You two are already connected. Great!'),
    ).toBeVisible();
  } finally {
    await withE2eDb(db =>
      db.collection('contacts').replaceOne({ _id: contact._id }, contact),
    );
  }
});
