import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ContactsCommon from '@/modules/contacts/client/components/ContactsCommon.component';
import { getContactsCommon } from '@/modules/contacts/client/api/contacts.api';
import type { ContactListEntry } from '@/modules/contacts/client/types';
import type Contact from '@/modules/contacts/client/components/Contact';

const getContactsCommonMock = jest.mocked(getContactsCommon);

jest.mock('@/modules/contacts/client/api/contacts.api');

jest.mock('@/modules/contacts/client/components/Contact', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockContact({
    avatarSize,
    className,
    contact,
    hideMeta,
    selfId,
  }: React.ComponentProps<typeof Contact>) {
    return (
      <div
        data-avatar-size={avatarSize}
        data-class-name={className}
        data-hide-meta={hideMeta}
        data-self-id={selfId}
      >
        {contact.user.displayName}
      </div>
    );
  }

  MockContact.propTypes = {
    avatarSize: () => null,
    className: () => null,
    contact: () => null,
    hideMeta: () => null,
    selfId: () => null,
  };

  return MockContact;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<ContactsCommon />', () => {
  it('renders nothing when there are no common contacts', async () => {
    getContactsCommonMock.mockResolvedValue([]);

    const { container } = render(<ContactsCommon profileId="profile-1" />);

    await waitFor(() =>
      expect(getContactsCommonMock).toHaveBeenCalledWith('profile-1'),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('loads and renders common contacts with Contact props', async () => {
    const commonContacts: ContactListEntry[] = [
      {
        _id: 'contact-1',
        confirmed: true,
        created: '2020-01-01T00:00:00.000Z',
        user: {
          _id: 'alice-1',
          username: 'alice',
          displayName: 'Alice Example',
        },
      },
      {
        _id: 'contact-2',
        confirmed: true,
        created: '2020-01-01T00:00:00.000Z',
        user: { _id: 'bob-1', username: 'bob', displayName: 'Bob Example' },
      },
    ];
    getContactsCommonMock.mockResolvedValue(commonContacts);

    render(<ContactsCommon profileId="profile-2" />);

    const alice = await screen.findByText('Alice Example');
    expect(screen.getByText('2 contacts in common')).toBeInTheDocument();
    expect(screen.getByText('Bob Example')).toBeInTheDocument();
    expect(alice).toHaveAttribute('data-avatar-size', '64');
    expect(alice).toHaveAttribute('data-class-name', 'contacts-contact');
    expect(alice).toHaveAttribute('data-hide-meta', 'true');
    expect(alice).toHaveAttribute('data-self-id', 'profile-2');
  });
});
