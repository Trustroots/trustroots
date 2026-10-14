import { matchToken, setToken } from './action-token.server.service.mjs';

export const EMAIL_CONFIRMATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Confirmation links issued before expiry metadata existed stay valid until
// this instant. There is no deployment setting for the cut-off.
export const EMAIL_CONFIRMATION_LEGACY_DEADLINE = new Date(
  '2026-11-01T00:00:00.000Z',
);

export function setEmailConfirmationToken(user, token, issuedAt = new Date()) {
  const issued = new Date(issuedAt);
  setToken(user, 'emailToken', token);
  user.emailTokenIssuedAt = issued;
  user.emailTokenExpires = new Date(
    issued.getTime() + EMAIL_CONFIRMATION_LIFETIME_MS,
  );
}

export function emailConfirmationTokenQuery(token, now = new Date()) {
  const validExpiry = [{ emailTokenExpires: { $gt: now } }];
  if (now.getTime() < EMAIL_CONFIRMATION_LEGACY_DEADLINE.getTime()) {
    validExpiry.push({ emailTokenExpires: { $exists: false } });
  }

  return {
    emailToken: matchToken(token),
    emailTemporary: { $type: 'string', $ne: '' },
    $or: validExpiry,
  };
}
