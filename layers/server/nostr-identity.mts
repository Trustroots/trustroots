import type { NostrIdentity } from '../../modules/core/server/services/nostr-identity.server.contract.mts';
import { isLegacyUsernameLookupValid } from '../../modules/users/server/services/authentication.server.service.mts';
import {
  findPublicNip05Usernames,
  readAuthorVisibility,
  readPublicNip05Npub,
} from '../../modules/users/server/services/nostr-identity.server.service.mts';

export const nostrIdentity = {
  findPublicNip05Usernames,
  isLegacyUsernameLookupValid,
  readAuthorVisibility,
  readPublicNip05Npub,
} satisfies NostrIdentity;
