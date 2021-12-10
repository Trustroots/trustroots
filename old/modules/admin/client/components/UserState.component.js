// External dependencies
import classnames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Gives information about different profile "states" useful for debugging for support requests:
 * - Labels for different un-usual user roles such as "suspended"
 * - If user is not "public"
 * - If email is unconfirmed
 * - If user is removing themself
 * - If user is changing password
 */
export default function UserState({ user }) {
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
      {roles &&
        roles.length &&
        roles
          .filter(role => role !== 'user')
          .map(role => {
            const classes = classnames('label admin-label', {
              'label-danger': ['suspended', 'shadowban'].includes(role),
              'label-success': [
                'admin',
                'moderator',
                'volunteer',
                'volunteer-alumni',
              ].includes(role),
            });

            return (
              <span className={classes} key={role}>
                {role}
              </span>
            );
          })}

      {/* Is profile public? */}
      {!user.public && (
        <span className="label label-danger admin-label">Hidden profile</span>
      )}

      {/* Has email been confirmed */}
      {emailTemporary && (
        <span className="label label-warning admin-label">
          {
            // On initial signup both `email` and `emailTemporary` are the same, when email is confirmed
            // `emailTemporary` is set empty. When user changes email, these values are different.
            emailTemporary === email
              ? 'Unconfirmed signup'
              : 'Unconfirmed email change'
          }
        </span>
      )}

      {/* Pending removal? */}
      {removeProfileToken && (
        <span
          className="label label-warning admin-label"
          title={`Link expiration ${removeProfileExpires}`}
        >
          Pending removal
        </span>
      )}

      {/* Pending password change? */}
      {resetPasswordToken && (
        <span
          className="label label-warning admin-label"
          title={`Link expiration ${resetPasswordExpires}`}
        >
          Pending password change
        </span>
      )}
    </div>
  );
}

UserState.propTypes = {
  user: PropTypes.object.isRequired,
};
