export function getAdminUserHref(user: {
  _id: string;
  username?: string;
}): string {
  return user.username
    ? `/admin/user/${encodeURIComponent(user.username)}`
    : `/admin/user?id=${encodeURIComponent(user._id)}`;
}
