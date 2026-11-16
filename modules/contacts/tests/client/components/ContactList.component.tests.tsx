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
  it('announces loading while contacts are unresolved', () => {
    render(
      <ContactList
        appUser={appUser}
        contacts={undefined}
        onContactRemoved={() => {}}
        loadFailed={false}
        onRetry={() => {}}
      />,
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByRole('heading', { name: 'Loading contacts…' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when resolved contacts are empty', () => {
    const contacts = resolvedContacts([]);

    render(
      <ContactList
        appUser={appUser}
        contacts={contacts}
        onContactRemoved={() => {}}
        loadFailed={false}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'People you connect with on Trustroots will appear here.',
      ),
    ).toBeInTheDocument();
  });

  it('offers an accessible retry when loading contacts fails', () => {
    const onRetry = jest.fn();
    render(
      <ContactList
        appUser={appUser}
        contacts={resolvedContacts([])}
        onContactRemoved={() => {}}
        loadFailed
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Contacts unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
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
        loadFailed={false}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByText('contacts:1')).toBeInTheDocument();
    expect(screen.getByText('filter:')).toBeInTheDocument();
    expect(screen.getByText('self:me')).toBeInTheDocument();

    fireEvent.click(screen.getByText('filter contacts'));

    expect(screen.getByText('filter:alice')).toBeInTheDocument();
  });
});
