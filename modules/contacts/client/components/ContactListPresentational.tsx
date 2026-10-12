import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import Contact from './Contact';
import type { ContactListEntry } from '../types';

export default function ContactListPresentational({
  selfId,
  contacts,
  filter,
  onContactRemoved,
  onFilterChange,
}: {
  selfId: string;
  contacts: ContactListEntry[];
  filter: string;
  onContactRemoved: (contact: ContactListEntry) => void;
  onFilterChange: (filter: string) => void;
}) {
  const { t } = useTranslation('contacts') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const sortContacts = (items: ContactListEntry[]) =>
    [...items].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.user.displayName || a.user.username).localeCompare(
          b.user.displayName || b.user.username,
          undefined,
          { sensitivity: 'base' },
        );
      }
      return (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0);
    });

  const confirmed = sortContacts(contacts.filter(contact => contact.confirmed));
  const unconfirmed = sortContacts(
    contacts.filter(contact => !contact.confirmed),
  );

  /**
   * We can also apply a filter on users
   * to see only a subset of users, who contain a specified string
   */
  const confirmedFiltered = filterContacts(confirmed, filter);
  const unconfirmedFiltered = filterContacts(unconfirmed, filter);

  return (
    <div className="contacts-list">
      <div className="row">
        <div className="col-xs-12 col-sm-5">
          <h4 className="text-muted">
            {/* Confirmed contacts */}
            <span>
              {t('{{count}} contacts', { count: confirmed.length }) as string}
            </span>{' '}
            {/* Pending contacts */}
            {unconfirmed.length > 0 && (
              <small>
                {
                  t('(additional {{count}} pending)', {
                    count: unconfirmed.length,
                  }) as string
                }
              </small>
            )}
          </h4>
        </div>

        <div className="col-xs-12 col-sm-7">
          <div className="contacts-list-controls">
            <div className="form-group">
              <label htmlFor="contacts-sort">{t('Sort by') as string}</label>
              <select
                id="contacts-sort"
                className="form-control"
                value={sortBy}
                onChange={event =>
                  setSortBy(event.target.value as 'date' | 'name')
                }
              >
                <option value="date">
                  {t('Date added (newest first)') as string}
                </option>
                <option value="name">{t('Name (A–Z)') as string}</option>
              </select>
            </div>
            {contacts.length >= 6 && (
              <div className="form-group">
                <label htmlFor="contacts-search" className="sr-only">
                  {t('Search contacts') as string}
                </label>
                <input
                  id="contacts-search"
                  type="text"
                  className="form-control"
                  onChange={event => onFilterChange(event.target.value)}
                  placeholder={t('Search contacts') as string}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {
        // Produce two rows, one for unconfirmed contacts and another for confirmed contacts
        [unconfirmedFiltered, confirmedFiltered].map(
          (filteredContacts, index) =>
            filteredContacts.length > 0 && (
              <div className="contacts-grid" key={index}>
                {filteredContacts.map(contact => (
                  <div key={contact._id}>
                    <Contact
                      className="contacts-contact panel panel-default"
                      contact={contact}
                      avatarSize={64}
                      selfId={selfId}
                      onContactRemoved={() => onContactRemoved(contact)}
                    />
                  </div>
                ))}
              </div>
            ),
        )
      }
    </div>
  );
}

ContactListPresentational.propTypes = {
  contacts: PropTypes.array,
  filter: PropTypes.string.isRequired,
  selfId: PropTypes.string.isRequired,
  onContactRemoved: PropTypes.func.isRequired,
  onFilterChange: PropTypes.func.isRequired,
};

/**
 * Filters contacts whose user has a string field containing the given text.
 * Case insensitive, shallow fields only.
 * @TODO improve it!
 */
function filterContacts(
  contacts: ContactListEntry[],
  filter: string,
): ContactListEntry[] {
  return contacts.filter(({ user }) => {
    for (const value of Object.values(user)) {
      if (
        typeof value === 'string' &&
        value.toLowerCase().includes(filter.toLowerCase())
      )
        return true;
    }
    return false;
  });
}
