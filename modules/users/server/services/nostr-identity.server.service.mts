import mongoose from 'mongoose';
import type { UserServerRecord } from '../models/user.server.types.mts';

const publicNip05MemberFilter = {
  public: true,
  email: { $exists: true, $nin: ['', null] },
  roles: { $nin: ['suspended', 'shadowban'] },
};

export async function findPublicNip05Usernames(npubs: string[]) {
  const User = mongoose.model<{ nostrNpub: string; username: string }>('User');
  const members = await User.find({
    ...publicNip05MemberFilter,
    nostrNpub: { $in: [...new Set(npubs)] },
  })
    .select('nostrNpub username')
    .lean();
  return new Map(members.map(member => [member.nostrNpub, member.username]));
}

type NostrMember = Pick<
  UserServerRecord,
  'username' | 'nostrNpub' | 'public' | 'email' | 'roles'
>;

export async function readPublicNip05Npub(username: string) {
  const User = mongoose.model<NostrMember>('User');
  const member = await User.findOne({ ...publicNip05MemberFilter, username });
  return member?.nostrNpub;
}

export async function readAuthorVisibility(npubs: string[]) {
  const User = mongoose.model<NostrMember>('User');
  // Stryker disable next-line ObjectLiteral: the response filters the found users by the requested keys again, so the query only narrows the fetch
  const users = await User.find({ nostrNpub: { $in: npubs } });
  const linkedNpubs = new Set(users.map(user => user.nostrNpub));
  const visibleUsernames = new Map(
    users
      .filter(
        user =>
          user.public &&
          user.email &&
          !user.roles.some(role => ['suspended', 'shadowban'].includes(role)),
      )
      .map(user => [user.nostrNpub, user.username]),
  );
  return { linkedNpubs, visibleUsernames };
}
