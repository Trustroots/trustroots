export interface ProfileDeletionFields {
  removeProfileToken?: unknown;
  removeProfileExpires?: Date | number | string | null;
}

export function isProfileDeletionPending(
  user: ProfileDeletionFields | null | undefined,
  now = Date.now(),
): boolean {
  if (!user || !user.removeProfileToken) return false;
  if (!user.removeProfileExpires) return true;

  const expiresAt = new Date(user.removeProfileExpires).getTime();
  return !Number.isFinite(expiresAt) || expiresAt > now;
}
