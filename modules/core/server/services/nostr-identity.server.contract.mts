export type FindPublicNip05Usernames = (
  npubs: string[],
) => Promise<Map<string, string>>;

export interface NostrIdentity {
  findPublicNip05Usernames: FindPublicNip05Usernames;
  isLegacyUsernameLookupValid(username: unknown): boolean;
  readPublicNip05Npub(username: string): Promise<string | undefined>;
  readAuthorVisibility(npubs: string[]): Promise<{
    linkedNpubs: Set<string | undefined>;
    visibleUsernames: Map<string | undefined, string>;
  }>;
}
