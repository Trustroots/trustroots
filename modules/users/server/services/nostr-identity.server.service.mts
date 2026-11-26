import mongoose from 'mongoose';
import type { UserServerRecord } from '../models/user.server.types.mts';

const publicNip05MemberFilter = {
  public: true,
  email: { $exists: true, $nin: ['', null] },
  roles: { $nin: ['suspended', 'shadowban'] },
};

export async function findNostrUsersByNpubs(npubs: string[]) {
  const User = mongoose.model<UserServerRecord>('User');
  return User.find({ nostrNpub: { $in: npubs } });
}

export async function findPublicNip05User(username: string) {
  const User = mongoose.model<UserServerRecord>('User');
  return User.findOne({ ...publicNip05MemberFilter, username });
}

export async function findPublicNip05Usernames(
  npubs: string[],
): Promise<Map<string, string>> {
  const User = mongoose.model<UserServerRecord>('User');
  const members = await User.find({
    ...publicNip05MemberFilter,
    nostrNpub: { $in: [...new Set(npubs)] },
  })
    .select('nostrNpub username')
    .lean<{ nostrNpub: string; username: string }[]>();
  return new Map(members.map(member => [member.nostrNpub, member.username]));
}
