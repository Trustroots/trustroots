import classnames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import Contact from './Contact';

export default function ContactListPresentational({
  selfId,
  contacts,
  filter,
  onContactRemoved,
  onFilterChange,
}) {
  const { t } = useTranslation('contacts');

  const confirmed = contacts.filter(contact => contact.confirmed);
  const unconfirmed = contacts.filter(contact => !contact.confirmed);

  /**
   * We can also apply a filter on users
   * to see only a subset of users, who contain a specified string
   */
  const confirmedFiltered = filterContacts(confirmed, filter);
  const unconfirmedFiltered = filterContacts(unconfirmed, filter);

  return (
    <div className="contacts-list">
      <div className="row">
        <div
          className={classnames('col-xs-12', {
            'col-sm-8': contacts.length >= 6,
            'text-center': contacts.length < 6,
          })}
        >
          <h4 className="text-muted">
            {/* Confirmed contacts */}
            <span>
              {t('{{count}} contacts', { count: confirmed.length })}
            </span>{' '}
            {/* Pending contacts */}
            {unconfirmed.length > 0 && (
              <small>
                {t('(additional {{count}} pending)', {
                  count: unconfirmed.length,
                })}
              </small>
            )}
          </h4>
        </div>

        {
          /**
           * When there are 6+ users, provide a field for filtering contacts
           */
          contacts.length >= 6 && (
            <div className="col-xs-12 col-sm-4 text-right">
              <div className="form-group">
                <label htmlFor="contacts-search" className="sr-only">
                  {t('Search contacts')}
                </label>
                <input
                  id="contacts-search"
                  type="text"
                  className="form-control"
                  onChange={event => onFilterChange(event.target.value)}
                  placeholder="Search contacts..."
                />
              </div>
            </div>
          )
        }
      </div>

      {
        // Produce two rows, one for unconfirmed contacts and another for confirmed contacts
        [unconfirmedFiltered, confirmedFiltered].map(
          (filteredContacts, index) =>
            filteredContacts.length > 0 && (
              <div className="row" key={index}>
                {filteredContacts.map(contact => (
                  <div className="col-xs-12 col-sm-6" key={contact._id}>
                    <Contact
                      className="contacts-contact panel panel-default"
                      contact={contact}
                      avatarSize={128}
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
 * This filter is probably different from the AngularJS filter.
 * It filters contacts with users, who contain a given string in one of their string fields (shallow)
 * Case insensitive.
 * @TODO improve it!
 */
function filterContacts(contacts, filter) {
  return contacts.filter(({ user }) => {
    for (const key in user) {
      if (
        typeof user[key] === 'string' &&
        user[key].toLowerCase().includes(filter.toLowerCase())
      )
        return true;
    }
    return false;
  });
}
