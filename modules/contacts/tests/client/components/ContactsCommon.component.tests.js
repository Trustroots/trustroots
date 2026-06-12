import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ContactsCommon from '@/modules/contacts/client/components/ContactsCommon.component';
import { getContactsCommon } from '@/modules/contacts/client/api/contacts.api';

jest.mock('@/modules/contacts/client/api/contacts.api');

jest.mock('@/modules/contacts/client/components/Contact', () => {
  const React = require('react');

  function MockContact({ avatarSize, className, contact, hideMeta, selfId }) {
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
    getContactsCommon.mockResolvedValue([]);

    const { container } = render(<ContactsCommon profileId="profile-1" />);

    await waitFor(() =>
      expect(getContactsCommon).toHaveBeenCalledWith('profile-1'),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('loads and renders common contacts with Contact props', async () => {
    getContactsCommon.mockResolvedValue([
      {
        _id: 'contact-1',
        user: { displayName: 'Alice Example' },
      },
      {
        _id: 'contact-2',
        user: { displayName: 'Bob Example' },
      },
    ]);

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
