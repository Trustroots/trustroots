import { expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import { insertContact, withE2eDb } from '../../support/db.mts';

test('contact confirmation retains guest and missing-request behaviour', async ({
  page,
}) => {
  await page.goto('/contact-confirm/665000000000000000000090');
  await expect(page).toHaveURL(/\/signin(?:\?|$)/);
  await signInViaApi(page, undefined, SEEDED_RELATIONSHIP_MEMBERS.alice);
  await page.goto('/contact-confirm/665000000000000000000090');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.getByText(/Could not find contact request/)).toBeVisible();
});

test('recipient can confirm a pending contact and reopen the result', async ({
  page,
}) => {
  const { alice } = SEEDED_RELATIONSHIP_MEMBERS;
  const contactId = await insertContact(SEEDED_MEMBERS[0].id, alice.id, false);
  try {
    await signInViaApi(page, undefined, alice);
    await page.goto(`/contact-confirm/${contactId}`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm contact' }).click();
    await expect(page.getByText('You two are now connected!')).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('You two are already connected. Great!'),
    ).toBeVisible();
  } finally {
    await withE2eDb(db =>
      db.collection('contacts').deleteOne({ _id: contactId }),
    );
  }
});
