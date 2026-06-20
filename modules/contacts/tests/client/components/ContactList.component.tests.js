import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ContactList from '@/modules/contacts/client/components/ContactList.component';

jest.mock(
  '@/modules/contacts/client/components/ContactListPresentational',
  () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    function MockContactListPresentational({
      contacts,
      filter,
      onFilterChange,
      selfId,
    }) {
      return (
        <div>
          <div>{`contacts:${contacts.length}`}</div>
          <div>{`filter:${filter}`}</div>
          <div>{`self:${selfId}`}</div>
          <button onClick={() => onFilterChange('alice')}>
            filter contacts
          </button>
        </div>
      );
    }
    MockContactListPresentational.propTypes = {
      contacts: PropTypes.array.isRequired,
      filter: PropTypes.string.isRequired,
      onFilterChange: PropTypes.func.isRequired,
      selfId: PropTypes.string.isRequired,
    };
    return MockContactListPresentational;
  },
);

describe('<ContactList />', () => {
  it('shows a loading indicator while contacts are unresolved', () => {
    render(
      <ContactList
        appUser={{ _id: 'me' }}
        contacts={undefined}
        onContactRemoved={() => {}}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
  });

  it('shows an empty state when resolved contacts are empty', () => {
    const contacts = [];
    contacts.$resolved = true;

    render(
      <ContactList
        appUser={{ _id: 'me' }}
        contacts={contacts}
        onContactRemoved={() => {}}
      />,
    );

    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
  });

  it('passes resolved contacts and filter changes to the presentational list', () => {
    const contacts = [{ _id: 'contact-1' }];
    contacts.$resolved = true;

    render(
      <ContactList
        appUser={{ _id: 'me' }}
        contacts={contacts}
        onContactRemoved={() => {}}
      />,
    );

    expect(screen.getByText('contacts:1')).toBeInTheDocument();
    expect(screen.getByText('filter:')).toBeInTheDocument();
    expect(screen.getByText('self:me')).toBeInTheDocument();

    fireEvent.click(screen.getByText('filter contacts'));

    expect(screen.getByText('filter:alice')).toBeInTheDocument();
  });
});
