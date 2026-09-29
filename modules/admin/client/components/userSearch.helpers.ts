export const MONGO_OBJECT_ID_LENGTH = 24;
export const SEARCH_STRING_LIMIT = 3;

type ExactMatchField = 'username' | 'email' | 'emailTemporary';

const DEFAULT_EXACT_MATCH_FIELDS: ExactMatchField[] = [
  'username',
  'email',
  'emailTemporary',
];

interface AdminUserCandidate {
  _id: string;
  username?: string;
  email?: string;
  emailTemporary?: string;
  displayName?: string;
  public?: boolean;
  roles?: string[];
  profile?: { roles?: string[] };
}

interface ReferenceThreadIdentity {
  userFrom?: string | { _id: string };
  userTo?: string | { _id: string };
}

export function normalizeAdminQuery(query: unknown): string {
  return String(query || '').trim();
}

export function isMongoObjectId(query: unknown): boolean {
  const normalizedQuery = normalizeAdminQuery(query);
  return (
    normalizedQuery.length === MONGO_OBJECT_ID_LENGTH &&
    /^[a-f0-9]+$/i.test(normalizedQuery)
  );
}

export function isExactUserMatch(
  query: unknown,
  user: AdminUserCandidate | null | undefined,
  fields: readonly ExactMatchField[] = DEFAULT_EXACT_MATCH_FIELDS,
) {
  const normalizedQuery = normalizeAdminQuery(query).toLowerCase();
  return fields
    .map(field => user?.[field])
    .filter((value): value is string => Boolean(value))
    .some(value => value.toLowerCase() === normalizedQuery);
}

export async function resolveExactMemberId(
  query: unknown,
  searchUsers: (query: string) => Promise<AdminUserCandidate[]>,
  fields: readonly ExactMatchField[] = ['username'],
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

export function getReferenceUserId(
  referenceThread: ReferenceThreadIdentity,
  field: 'userFrom' | 'userTo',
) {
  const user = referenceThread[field];
  return user && (typeof user === 'string' ? user : user._id).toString();
}

export function formatAdminDate(date?: Date | string | number | null) {
  if (!date) {
    return '';
  }
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return String(date).slice(0, 10);
}

export function isObviousSpamUser(user: AdminUserCandidate) {
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

export function isSuspendedUser(user: AdminUserCandidate | null | undefined) {
  const roles = getUserRoles(user);
  return roles.includes('suspended');
}

function getUserRoles(user: AdminUserCandidate | null | undefined): string[] {
  return (user && (user.roles || (user.profile && user.profile.roles))) || [];
}
