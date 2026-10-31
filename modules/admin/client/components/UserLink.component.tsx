// External dependencies
import React from 'react';
import { getAdminUserHref } from '../utils/member-url';
import { useAuth } from '../../../core/client/react-app/auth';

interface UserSummary {
  _id?: string;
  displayName?: string;
  username?: string;
}

export default function UserLink({
  user,
  publicProfile = false,
}: {
  user?: UserSummary | null;
  publicProfile?: boolean;
}) {
  const { hasRole } = useAuth();
  if (!user || !user._id) {
    return <em>Unknown</em>;
  }

  const { _id, displayName, username } = user;
  const label =
    username && displayName
      ? `${username} (${displayName})`
      : username || displayName || 'Unknown member';
  if (publicProfile) {
    return username ? (
      <a href={`/profile/${username}`}>{label}</a>
    ) : (
      <span>{label}</span>
    );
  }
  if (hasRole('support-team') && !hasRole('admin')) {
    return username ? (
      <a href={`/admin/support/member/${encodeURIComponent(username)}`}>
        {label}
      </a>
    ) : (
      <a href={`/admin/support/member/${encodeURIComponent(_id)}`}>{label}</a>
    );
  }
  return <a href={getAdminUserHref({ _id, username })}>{label}</a>;
}
