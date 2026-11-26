import type { CoreRouteDependencies } from '../../modules/core/server/routes/core.server.routes.mts';
import userProfile from '../../modules/users/server/controllers/users.profile.server.controller.mts';
import type { UserServerDocument } from '../../modules/users/server/models/user.server.types.mts';
import authenticationService from '../../modules/users/server/services/authentication.server.service.mts';
import {
  findNostrUsersByNpubs,
  findPublicNip05User,
  findPublicNip05Usernames,
} from '../../modules/users/server/services/nostr-identity.server.service.mts';

export const coreUserServices = {
  sanitizeOwnProfile: user =>
    userProfile.sanitizeOwnProfile(user as UserServerDocument),
  isLegacyUsernameLookupValid:
    authenticationService.isLegacyUsernameLookupValid,
  findNostrUsers: findNostrUsersByNpubs,
  findNip05User: findPublicNip05User,
  findPublicNip05Usernames,
} satisfies CoreRouteDependencies;
