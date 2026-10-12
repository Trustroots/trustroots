import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ContactList from '@/modules/contacts/client/components/ContactList.component';
import type ContactListPresentational from '@/modules/contacts/client/components/ContactListPresentational';
import type {
  ContactList as ContactListData,
  ContactListEntry,
} from '@/modules/contacts/client/types';
import type { UserProfile } from '@/modules/users/client/types';

type PresentationalProps = React.ComponentProps<
  typeof ContactListPresentational
>;

const appUser: UserProfile = {
  _id: 'me',
  username: 'viewer',
  displayName: 'Circle Viewer',
};

function resolvedContacts(entries: ContactListEntry[]): ContactListData {
  return Object.assign(entries, { $resolved: true });
}

jest.mock(
  '@/modules/contacts/client/components/ContactListPresentational',
  () => {
    function MockContactListPresentational({
      contacts,
      filter,
      onFilterChange,
      selfId,
    }: Pick<
      PresentationalProps,
      'contacts' | 'filter' | 'onFilterChange' | 'selfId'
    >) {
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
    return MockContactListPresentational;
  },
);

describe('<ContactList />', () => {
  it('shows a loading indicator while contacts are unresolved', () => {
    render(
      <ContactList
        appUser={appUser}
        contacts={undefined}
        onContactRemoved={() => {}}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
  });

  it('shows an empty state when resolved contacts are empty', () => {
    const contacts = resolvedContacts([]);

    render(
      <ContactList
        appUser={appUser}
        contacts={contacts}
        onContactRemoved={() => {}}
      />,
    );

    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
  });

  it('passes resolved contacts and filter changes to the presentational list', () => {
    const contacts = resolvedContacts([
      {
        _id: 'contact-1',
        confirmed: true,
        created: '2025-01-02T00:00:00.000Z',
        user: {
          _id: 'member-1',
          username: 'member',
          displayName: 'Member',
        },
      },
    ]);

    render(
      <ContactList
        appUser={appUser}
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
