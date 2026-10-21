export function getAdminUserHref(user: {
  _id: string;
  username?: string;
}): string {
  return user.username
    ? `/admin/user/${encodeURIComponent(user.username)}`
    : `/admin/user?id=${encodeURIComponent(user._id)}`;
}

type AdminMessageMember =
  { _id?: string; username?: string } | string | null | undefined;

export function getAdminMessagesHref(
  user1: AdminMessageMember,
  user2: AdminMessageMember,
): string | null {
  const params: string[] = [];

  for (const [index, user] of [user1, user2].entries()) {
    const number = index + 1;
    const username = typeof user === 'object' && user ? user.username : '';
    const userId = typeof user === 'string' ? user : user?._id;

    if (username) {
      params.push(`username${number}=${encodeURIComponent(username)}`);
    } else if (userId) {
      params.push(`userId${number}=${encodeURIComponent(userId)}`);
    } else {
      return null;
    }
  }

  return `/admin/messages?${params.join('&')}`;
}
