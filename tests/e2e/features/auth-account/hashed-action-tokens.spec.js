const { test, expect } = require('../../support/fixtures');
const { createUser, registerViaApi } = require('../../support/helpers');
const { findUserByUsername, findActionToken } = require('../../support/db');
const crypto = require('crypto');

test('email links work while stored digests cannot be used as bearer tokens', async ({
  request,
}) => {
  const user = createUser();
  await registerViaApi(request, user);
  const stored = await findUserByUsername(user.username);
  const confirmation = await findActionToken(user.username, 'emailToken');
  expect(stored.emailToken).toBe(
    'sha256:' + crypto.createHash('sha256').update(confirmation).digest('hex'),
  );
  expect(
    (
      await request.post(`/api/auth/confirm-email/${stored.emailToken}`, {
        headers: { 'X-Trustroots-Request': '1' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`/api/auth/confirm-email/${confirmation}`, {
        headers: { 'X-Trustroots-Request': '1' },
      })
    ).status(),
  ).toBe(200);

  await request.post('/api/auth/forgot', { data: { username: user.username } });
  let resetToken;
  await expect
    .poll(async () => {
      try {
        resetToken = await findActionToken(user.username, 'resetPasswordToken');
        return Boolean(resetToken);
      } catch {
        return false;
      }
    })
    .toBe(true);
  const recovery = await findUserByUsername(user.username);
  expect(recovery.resetPasswordToken).toBe(
    'sha256:' + crypto.createHash('sha256').update(resetToken).digest('hex'),
  );
  const data = {
    newPassword: 'FictionalReplacementPassword12!',
    verifyPassword: 'FictionalReplacementPassword12!',
  };
  expect(
    (
      await request.post(`/api/auth/reset/${recovery.resetPasswordToken}`, {
        data,
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post(`/api/auth/reset/${resetToken}`, { data })).status(),
  ).toBe(200);
  expect(
    (await request.post(`/api/auth/reset/${resetToken}`, { data })).status(),
  ).toBe(400);
  expect(
    (await findUserByUsername(user.username)).resetPasswordToken,
  ).toBeUndefined();
});
