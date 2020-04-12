import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Contact from './Contact';
import { getContactsCommon } from '../api/contacts.api';
import '@/config/client/i18n';

export default function ContactsCommon({ profileId }) {
  const { t } = useTranslation('contacts');
  const [contacts, setContacts] = useState([]);

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
        {t('{{count}} contacts in common', {
          count: contacts.length,
        })}
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
