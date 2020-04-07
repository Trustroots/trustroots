import { useTranslation } from 'react-i18next';
import ContactListPresentational from './ContactListPresentational';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import NoContent from '@/modules/core/client/components/NoContent';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

export default function ContactList({ appUser, contacts, onContactRemoved }) {
  const { t } = useTranslation('contacts');
  const [filter, setFilter] = useState('');

  if (!contacts || !contacts.$resolved) {
    return <LoadingIndicator />;
  }

  if (contacts.length === 0) {
    return <NoContent icon="users" message={t('No contacts yet.')} />;
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

ContactList.propTypes = {
  appUser: PropTypes.object.isRequired,
  contacts: PropTypes.array,
  onContactRemoved: PropTypes.func.isRequired,
};
