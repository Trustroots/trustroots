import type { BootstrapUser } from '../../modules/core/server/controllers/core.server.controller.mts';
import userProfile from '../../modules/users/server/controllers/users.profile.server.controller.mts';
import type { UserServerDocument } from '../../modules/users/server/models/user.server.types.mts';

export function buildBootstrapUser(user: unknown): BootstrapUser | undefined {
  // Passport supplies the authenticated member document at the server boundary.
  const member = user as UserServerDocument;
  const profile: BootstrapUser | undefined =
    userProfile.sanitizeOwnProfile(member);

  // Only the current member's bootstrap includes roles needed by route guards.
  // The internal moderation flag is excluded from the response.
  if (member.roles) {
    profile!.roles = member.roles.filter(role => role !== 'flagged');
  }
  return profile;
}
