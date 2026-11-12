import mongoose from 'mongoose';

export const publicNip05MemberFilter = {
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
