export const MONGO_OBJECT_ID_LENGTH = 24;
export const SEARCH_STRING_LIMIT = 3;

const DEFAULT_EXACT_MATCH_FIELDS = ['username', 'email', 'emailTemporary'];

export function normalizeAdminQuery(query) {
  return String(query || '').trim();
}

export function isMongoObjectId(query) {
  const normalizedQuery = normalizeAdminQuery(query);
  return (
    normalizedQuery.length === MONGO_OBJECT_ID_LENGTH &&
    /^[a-f0-9]+$/i.test(normalizedQuery)
  );
}

export function isExactUserMatch(
  query,
  user,
  fields = DEFAULT_EXACT_MATCH_FIELDS,
) {
  const normalizedQuery = normalizeAdminQuery(query).toLowerCase();
  return fields
    .map(field => user && user[field])
    .filter(Boolean)
    .some(value => value.toLowerCase() === normalizedQuery);
}

export async function resolveExactMemberId(
  query,
  searchUsers,
  fields = ['username'],
) {
  const normalizedQuery = normalizeAdminQuery(query);
  if (isMongoObjectId(normalizedQuery)) {
    return normalizedQuery;
  }

  if (normalizedQuery.length < SEARCH_STRING_LIMIT) {
    return '';
  }

  const users = await searchUsers(normalizedQuery);
  const exactMatch = users.find(user =>
    isExactUserMatch(normalizedQuery, user, fields),
  );

  return exactMatch ? exactMatch._id : '';
}

export function getReferenceUserId(referenceThread, field) {
  const user = referenceThread[field];
  return user && (user._id || user).toString();
}

export function formatAdminDate(date) {
  if (!date) {
    return '';
  }
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return String(date).slice(0, 10);
}

export function isObviousSpamUser(user) {
  const displayName = user.displayName || '';
  const roles = user.roles || [];

  return (
    (roles.includes('suspended') &&
      !user.public &&
      user.emailTemporary &&
      user.emailTemporary === user.email) ||
    /(https?:\/\/|bit\.ly\/|tinyurl\.com\/|t\.co\/)/i.test(displayName) ||
    (/\b(hot|pretty)\b/i.test(displayName) &&
      /\b(date|meet|waiting|gaze)\b/i.test(displayName))
  );
}
