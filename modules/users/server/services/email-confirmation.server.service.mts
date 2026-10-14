import { matchToken, setToken } from './action-token.server.service.mts';

interface EmailConfirmationUser {
  $locals?: { actionTokens?: Record<string, string> };
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
}

type EmailConfirmationExpiry =
  | { emailTokenExpires: { $gt: Date } }
  | { emailTokenExpires: { $exists: false } };

interface EmailConfirmationQuery {
  emailToken: ReturnType<typeof matchToken>;
  emailTemporary: { $type: 'string'; $ne: '' };
  $or: EmailConfirmationExpiry[];
}

export const EMAIL_CONFIRMATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Confirmation links issued before expiry metadata existed stay valid until
// this instant. There is no deployment setting for the cut-off.
export const EMAIL_CONFIRMATION_LEGACY_DEADLINE = new Date(
  '2026-11-01T00:00:00.000Z',
);

export function setEmailConfirmationToken(
  user: EmailConfirmationUser,
  token: string,
  issuedAt: Date | string | number = new Date(),
): void {
  const issued = new Date(issuedAt);
  setToken(user, 'emailToken', token);
  user.emailTokenIssuedAt = issued;
  user.emailTokenExpires = new Date(
    issued.getTime() + EMAIL_CONFIRMATION_LIFETIME_MS,
  );
}

export function emailConfirmationTokenQuery(
  token: unknown,
  now = new Date(),
): EmailConfirmationQuery {
  const validExpiry: EmailConfirmationExpiry[] = [
    { emailTokenExpires: { $gt: now } },
  ];
  if (now.getTime() < EMAIL_CONFIRMATION_LEGACY_DEADLINE.getTime()) {
    validExpiry.push({ emailTokenExpires: { $exists: false } });
  }

  return {
    emailToken: matchToken(token),
    emailTemporary: { $type: 'string', $ne: '' },
    $or: validExpiry,
  };
}
