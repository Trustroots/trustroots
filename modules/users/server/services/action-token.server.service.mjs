import crypto from 'node:crypto';

export function hashToken(token) {
  return 'sha256:' + crypto.createHash('sha256').update(token).digest('hex');
}

export function matchToken(token) {
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

export function setToken(user, field, token) {
  user[field] = hashToken(token);
  user.$locals = user.$locals || {};
  user.$locals.actionTokens = { ...user.$locals.actionTokens, [field]: token };
}

export function emailToken(user, field) {
  return user.$locals?.actionTokens?.[field] || user[field];
}
