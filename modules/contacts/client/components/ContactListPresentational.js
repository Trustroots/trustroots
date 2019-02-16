import React from 'react';
import PropTypes from 'prop-types';
import '@/config/lib/i18n';
import { withNamespaces } from 'react-i18next';
import Contact from './Contact';

export function ContactListPresentational({ t, selfId, contacts, filter, onContactRemoved, onFilterChange }) {
  const confirmed = contacts.filter(contact => contact.confirmed);
  const unconfirmed = contacts.filter(contact => !contact.confirmed);

  /**
   * We can also apply a filter on users
   * to see only a subset of users, who contain a specified string
   */
  const confirmedFiltered = filterContacts(confirmed, filter);
  const unconfirmedFiltered = filterContacts(unconfirmed, filter);

  const overviewClassNames = ['col-xs-12', contacts.length >= 6 ? 'col-sm-8' : 'text-center'];

  return (
    <div className="contacts-list">
      <div className="row">
        <div className={overviewClassNames.join(' ')}>
          <h4 className="text-muted">

            {/* Confirmed contacts */}
            {confirmed.length === 1 && <span>{t('One contact')}</span>}
            {confirmed.length > 1 && <span>
              {t('{{amount}} contacts', { amount: confirmed.length })}
            </span>}
            {' '}
            {/* Pending contacts */}
            {unconfirmed.length > 0 && <small>
              {t('(additional {{amount}} pending)', { amount: unconfirmed.length })}
            </small>}

          </h4>
        </div>

        {
          /**
           * When there are 6+ users, provide a field for filtering contacts
           */
          contacts.length >=6 && <div className="col-xs-12 col-sm-4 text-right">
            <div className="form-group">
              <label htmlFor="contacts-search" className="sr-only">Search contacts</label>
              <input id="contacts-search" type="text" className="form-control" onChange={(event) => onFilterChange(event.target.value)} placeholder="Search contacts..." />
            </div>
          </div>
        }
      </div>

      {
        // Produce two rows, one for unconfirmed contacts and another for confirmed contacts
        [unconfirmedFiltered, confirmedFiltered].map(
          (filteredContacts, index) => filteredContacts.length > 0 && (
            <div className="row" key={index}>{filteredContacts.map(contact =>
              <div
                className="col-xs-12 col-sm-6"
                key={contact._id}
              >
                <Contact
                  className="contacts-contact panel panel-default"
                  contact={contact}
                  avatarSize={128}
                  selfId={selfId}
                  onContactRemoved={onContactRemoved}
                />
              </div>
            )}</div>
          )
        )
      }
    </div>
  );
}

ContactListPresentational.propTypes = {
  t: PropTypes.func.isRequired,
  contacts: PropTypes.array,
  filter: PropTypes.string.isRequired,
  selfId: PropTypes.string.isRequired,
  onContactRemoved: PropTypes.func.isRequired,
  onFilterChange: PropTypes.func.isRequired
};

export default withNamespaces('contact')(ContactListPresentational);

/**
 * This filter is probably different from the AngularJS filter.
 * It filters contacts with users, who contain a given string in one of their string fields (shallow)
 * Case insensitive.
 * @TODO improve it!
 */
function filterContacts(contacts, filter) {
  return contacts.filter(({ user }) => {
    for (const key in user) {
      if (typeof user[key] === 'string' && user[key].toLowerCase().includes(filter.toLowerCase())) return true;
    }
    return false;
  });
}
