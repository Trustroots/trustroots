import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import {
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, findActionToken } from '../../support/db.mts';

test('members can stage, cancel, and confirm an account email change', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'account.email-change', [
    'A member can stage an email change after confirming their current password.',
    'A member can cancel a pending email change.',
    'Only the current confirmation token can apply the staged address.',
  ]);

  const user = createUser();
  const pendingEmail = `${user.username}-pending@example.test`;
  const confirmedEmail = `${user.username}-confirmed@example.test`;
  await registerViaApi(request, user);
  const signupToken = await findActionToken(user.username, 'emailToken');
  await request.post(`/api/auth/confirm-email/${signupToken}`, {
    headers: { 'X-Trustroots-Request': '1' },
  });
  await signInViaApi(page, request, user);
  await page.goto('/profile/edit/account');

  await page.getByLabel('Email Address').fill(pendingEmail);
  await page
    .getByLabel('Current password to confirm email change')
    .fill(user.password);
  await page.getByRole('button', { name: 'Change email' }).click();
  await expect(
    page.getByText(/Email change will not be active until that/),
  ).toBeVisible();

  let saved = (await findUserByUsername(user.username))!;
  expect(saved.email).toBe(user.email);
  expect(saved.emailTemporary).toBe(pendingEmail);

  await page
    .getByRole('button', { name: 'Cancel pending email change' })
    .click();
  await expect(page.getByText('Pending email change cancelled.')).toBeVisible();
  saved = (await findUserByUsername(user.username))!;
  expect(saved.email).toBe(user.email);
  expect(saved.emailTemporary).toBeUndefined();

  await page.getByLabel('Email Address').fill(confirmedEmail);
  await page
    .getByLabel('Current password to confirm email change')
    .fill(user.password);
  await page.getByRole('button', { name: 'Change email' }).click();
  await expect(
    page.getByText(/Email change will not be active until that/),
  ).toBeVisible();

  const confirmationToken = await findActionToken(user.username, 'emailToken');
  expect(
    (
      await request.post(`/api/auth/confirm-email/${confirmationToken}`, {
        headers: { 'X-Trustroots-Request': '1' },
      })
    ).ok(),
  ).toBeTruthy();
  saved = (await findUserByUsername(user.username))!;
  expect(saved.email).toBe(confirmedEmail);
  expect(saved.emailTemporary).toBeUndefined();
});
