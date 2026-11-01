// External dependencies
import React from 'react';
import { Badge, type BadgeProps } from '@trustroots/ui/Badge';

import { formatRoleLabel } from '../utils/role-label';

// Restrictions are red and volunteer roles green; other team roles are grey.
function getRoleTone(role: string): BadgeProps['tone'] {
  if (['suspended', 'shadowban'].includes(role)) return 'danger';
  if (['admin', 'volunteer', 'volunteer-alumni'].includes(role))
    return 'success';
  return 'neutral';
}

/**
 * Gives information about different profile "states" useful for debugging for support requests:
 * - Labels for different un-usual user roles such as "suspended"
 * - If user is not "public"
 * - If email is unconfirmed
 * - If user is removing themself
 * - If user is changing password
 */
interface UserStateUser {
  email?: string;
  emailTemporary?: string;
  removeProfileExpires?: string;
  removeProfileToken?: string;
  resetPasswordExpires?: string;
  resetPasswordToken?: string;
  roles?: string[];
  public?: boolean;
}

export default function UserState({
  user,
  showRoles = true,
}: {
  user: UserStateUser;
  showRoles?: boolean;
}) {
  const {
    email,
    emailTemporary,
    removeProfileExpires,
    removeProfileToken,
    resetPasswordExpires,
    resetPasswordToken,
    roles,
  } = user;

  return (
    <div className="admin-user-state">
      {/* What special roles user has? */}
      {showRoles &&
        roles &&
        roles.length &&
        roles
          .filter(role => role !== 'user')
          .map(role => {
            return (
              <Badge variant="solid" tone={getRoleTone(role)} key={role}>
                {formatRoleLabel(role)}
              </Badge>
            );
          })}

      {/* Is profile public? */}
      {!user.public && (
        <Badge variant="solid" tone="danger">
          Hidden profile
        </Badge>
      )}

      {/* Has email been confirmed */}
      {emailTemporary && (
        <Badge variant="solid" tone="warning">
          {
            // On initial signup both `email` and `emailTemporary` are the same, when email is confirmed
            // `emailTemporary` is set empty. When user changes email, these values are different.
            emailTemporary === email
              ? 'Unconfirmed signup'
              : 'Unconfirmed email change'
          }
        </Badge>
      )}

      {/* Pending removal? */}
      {removeProfileToken && (
        <Badge
          variant="solid"
          tone="warning"
          title={`Link expiration ${removeProfileExpires}`}
        >
          Pending removal
        </Badge>
      )}

      {/* Pending password change? */}
      {resetPasswordToken && (
        <Badge
          variant="solid"
          tone="warning"
          title={`Link expiration ${resetPasswordExpires}`}
        >
          Pending password change
        </Badge>
      )}
    </div>
  );
}
