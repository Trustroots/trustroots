import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import type { UserProfile } from '../types';

/**
 * Link to a user
 * @param {User} user - user to link to
 * @param {string} user.displayName
 * @param {string} user.username
 */
export default function UserLink({
  user,
  className,
}: {
  user: Pick<UserProfile, 'username'> &
    Partial<Pick<UserProfile, 'displayName'>>;
  className?: string;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  if (!user?.username) {
    return <span className={className}>{t('Anonymous member')}</span>;
  }

  return (
    <a className={className} href={`/profile/${user?.username}`}>
      {user?.displayName || user?.username}
    </a>
  );
}

UserLink.propTypes = {
  className: PropTypes.string,
  user: PropTypes.object.isRequired,
};
