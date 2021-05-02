import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

import '@/config/client/i18n';
import * as api from '../api/block.api';

export default function BlockMember({ username, isBlocked, className }) {
  const { t } = useTranslation('users');

  function refreshUser() {
    // Refresh the page to reset global `window.app.user`
    // Once we have global state handler and whole user profile is in React, we can remove this.
    window.location.reload();
  }

  // Unblock member
  async function handleUnBlockMember(username) {
    const confirmation = window.confirm(
      t(
        'Are you sure you want to unblock them? They will be able to see your profile and messaage you again.',
      ),
    );

    if (confirmation) {
      const response = await api.unblock(username);

      if (response) {
        refreshUser();
      } else {
        window.alert(
          `${t('Could not unblock this member.')}\n\n${t(
            'Please ensure you are connected to internet and try again.',
          )}`,
        );
      }
    }
  }

  // Block member
  async function handleBlockMember(username) {
    const confirmation = window.confirm(
      t(
        'Are you sure you want to block them? They will not be able to see or message you.',
      ),
    );

    if (confirmation) {
      const response = await api.block(username);

      if (response) {
        refreshUser();
      } else {
        alert(
          `${t('Could not block this member.')}\n\n${t(
            'Please ensure you are connected to internet and try again.',
          )}`,
        );
      }
    }
  }

  if (isBlocked) {
    return (
      <button
        className={className}
        aria-label={t('Unblock member "{{username}}"', { username })}
        onClick={() => handleUnBlockMember(username)}
      >
        {t('Unblock member')}
      </button>
    );
  }

  return (
    <button
      className={className}
      aria-label={t('Block member "{{username}}"', { username })}
      onClick={() => handleBlockMember(username)}
    >
      {t('Block member')}
    </button>
  );
}

BlockMember.propTypes = {
  isBlocked: PropTypes.bool,
  className: PropTypes.string,
  username: PropTypes.string.isRequired,
};
