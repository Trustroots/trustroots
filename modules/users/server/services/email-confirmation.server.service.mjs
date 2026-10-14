import { matchToken, setToken } from './action-token.server.service.mjs';

export const EMAIL_CONFIRMATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function setEmailConfirmationToken(user, token, issuedAt = new Date()) {
  const issued = new Date(issuedAt);
  setToken(user, 'emailToken', token);
  user.emailTokenIssuedAt = issued;
  user.emailTokenExpires = new Date(
    issued.getTime() + EMAIL_CONFIRMATION_LIFETIME_MS,
  );
}

export function emailConfirmationTokenQuery(
  token,
  now = new Date(),
  legacyDeadline,
) {
  const validExpiry = [{ emailTokenExpires: { $gt: now } }];
  const deadline = new Date(legacyDeadline).getTime();
  if (Number.isFinite(deadline) && now.getTime() < deadline) {
    validExpiry.push({ emailTokenExpires: { $exists: false } });
  }

  return {
    emailToken: matchToken(token),
    emailTemporary: { $type: 'string', $ne: '' },
    $or: validExpiry,
  };
}
