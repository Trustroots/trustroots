import crypto from 'node:crypto';

interface ActionTokenUser {
  emailToken?: string;
  resetPasswordToken?: string;
  removeProfileToken?: string;
  $locals?: { actionTokens?: Record<string, string> };
}

export function hashToken(token: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(token).digest('hex');
}

export function matchToken(token: unknown): { $in: string[] } {
  // A stored digest must never itself become a bearer credential.
  if (
    typeof token !== 'string' ||
    !token ||
    token.length > 1024 ||
    token.startsWith('sha256:')
  ) {
    return { $in: [] };
  }
  return { $in: [hashToken(token), token] };
}

export function setToken(
  user: ActionTokenUser,
  field: string,
  token: string,
): void {
  Reflect.set(user, field, hashToken(token));
  user.$locals = user.$locals || {};
  user.$locals.actionTokens = { ...user.$locals.actionTokens, [field]: token };
}

export function emailToken(user: ActionTokenUser, field: string): unknown {
  return user.$locals?.actionTokens?.[field] || Reflect.get(user, field);
}
