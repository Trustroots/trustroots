import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Contact from './Contact';
import { getContactsCommon } from '../api/contacts.api';
import '@/config/client/i18n';
import type { ContactListEntry } from '../types';

export default function ContactsCommon({ profileId }: { profileId: string }) {
  const { t } = useTranslation('contacts') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [contacts, setContacts] = useState<ContactListEntry[]>([]);

  useEffect(() => {
    (async () => {
      const contacts = await getContactsCommon(profileId);
      setContacts(contacts);
    })();
  }, [profileId]);

  if (contacts.length === 0) return null;

  return (
    <div className="panel panel-default">
      {/* convert ng-pluralize with NamespacesConsumer */}
      <div className="panel-heading">
        {
          t('{{count}} contacts in common', {
            count: contacts.length,
          }) as string
        }
      </div>
      <div className="panel-body">
        {contacts.map(contact => (
          <Contact
            key={contact._id}
            contact={contact}
            className="contacts-contact"
            hideMeta={true}
            avatarSize={64}
            selfId={profileId}
          />
        ))}
      </div>
    </div>
  );
}

ContactsCommon.propTypes = {
  profileId: PropTypes.string,
};
