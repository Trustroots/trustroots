import { useTranslation } from 'react-i18next';
import React from 'react';

import '@/config/client/i18n';
import * as api from '../api/block.api';
import Icon from '@/modules/core/client/components/Icon';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';

export default function BlockMember({
  username,
  isBlocked = false,
  look = { size: 'sm' },
  className,
}: {
  username: string;
  isBlocked?: boolean;
  /** The button look; a small default button unless given. */
  look?: ButtonStyleProps;
  className?: string;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  function refreshUser() {
    // Refresh the page to reset global `window.app.user`
    // Once we have global state handler and whole user profile is in React, we can remove this.
    window.location.reload();
  }

  // Unblock member
  async function handleUnBlockMember(username: string) {
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
  async function handleBlockMember(username: string) {
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
      <Button
        {...look}
        className={className}
        aria-label={t('Unblock member "{{username}}"', { username })}
        onClick={() => handleUnBlockMember(username)}
      >
        <Icon icon="invalid" />
        {t('Unblock member')}
      </Button>
    );
  }

  return (
    <Button
      {...look}
      className={className}
      aria-label={t('Block member "{{username}}"', { username })}
      onClick={() => handleBlockMember(username)}
    >
      <Icon icon="invalid" />
      {t('Block member')}
    </Button>
  );
}
