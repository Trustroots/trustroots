import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import ContactListPresentational from './ContactListPresentational';
import ContentState from '@/modules/core/client/components/ContentState';
import React, { useState } from 'react';
import type { ContactList as ContactListData, ContactRecord } from '../types';
import type { UserProfile } from '@/modules/users/client/types';

export default function ContactList({
  appUser,
  contacts,
  onContactRemoved,
  loadFailed,
  onRetry,
}: {
  appUser: UserProfile;
  contacts?: ContactListData;
  onContactRemoved: (contact: ContactRecord) => void;
  loadFailed: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('contacts') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [filter, setFilter] = useState('');

  if (loadFailed) {
    return (
      <ContentState
        kind="error"
        heading={t('Contacts unavailable')}
        description={t('Could not load contacts. Please try again.')}
        action={
          <Button type="button" onClick={onRetry}>
            {t('Try again')}
          </Button>
        }
      />
    );
  }

  if (!contacts || !contacts.$resolved) {
    return (
      <ContentState
        kind="loading"
        heading={t('Loading contacts…')}
        description={t('Please wait while your contacts are loaded.')}
      />
    );
  }

  if (contacts.length === 0) {
    return (
      <ContentState
        kind="empty"
        heading={t('No contacts yet.')}
        description={t(
          'People you connect with on Trustroots will appear here.',
        )}
      />
    );
  }

  return (
    <ContactListPresentational
      contacts={contacts}
      filter={filter}
      onContactRemoved={onContactRemoved}
      onFilterChange={setFilter}
      selfId={appUser._id}
    />
  );
}
