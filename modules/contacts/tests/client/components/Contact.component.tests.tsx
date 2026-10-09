import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Contact from '@/modules/contacts/client/components/Contact';
import type { ContactListEntry } from '@/modules/contacts/client/types';
import type { UserSummary } from '@/modules/users/client/types';

function memberReference(
  id: string,
  username: string,
  displayName: string,
): UserSummary {
  return { _id: id, username, displayName };
}

jest.mock('@/modules/contacts/client/components/RemoveContactContainer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockRemoveContact({
    show,
    onCancel,
    onSuccess,
  }: {
    show?: boolean;
    onCancel?: () => void;
    onSuccess?: () => void;
  }) {
    return show ? (
      <div>
        <div>remove-modal-open</div>
        <button onClick={() => onCancel && onCancel()}>remove-cancel</button>
        <button onClick={() => onSuccess && onSuccess()}>remove-success</button>
      </div>
    ) : null;
  }
  MockRemoveContact.propTypes = {
    show: () => null,
    onCancel: () => null,
    onSuccess: () => null,
  };
  return MockRemoveContact;
});

function makeContact(
  overrides: Partial<ContactListEntry> = {},
): ContactListEntry {
  return {
    _id: 'contact-1',
    confirmed: true,
    created: '2020-01-01T00:00:00.000Z',
    userFrom: 'me',
    userTo: 'them',
    user: {
      _id: 'member-1',
      username: 'alice',
      displayName: 'Alice Example',
    },
    ...overrides,
  };
}

describe('<Contact />', () => {
  it('renders a confirmed contact', () => {
    render(<Contact contact={makeContact()} selfId="me" />);

    expect(
      screen.getByRole('link', { name: 'Alice Example' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('remove-modal-open')).not.toBeInTheDocument();
  });

  it('treats an unconfirmed request from self as "from me"', () => {
    render(
      <Contact
        contact={makeContact({ confirmed: false, userFrom: 'me' })}
        selfId="me"
      />,
    );

    expect(
      screen.getByText('Contact request sent and pending.'),
    ).toBeInTheDocument();
  });

  it('accepts embedded member objects in contact references', () => {
    render(
      <Contact
        contact={makeContact({
          confirmed: false,
          userFrom: memberReference(
            'someone-else',
            'other-member',
            'Other Member',
          ),
          userTo: memberReference('me', 'current-member', 'Current Member'),
        })}
        selfId="me"
      />,
    );

    expect(
      screen.getByText('You received a contact request.'),
    ).toBeInTheDocument();
  });

  it('opens the remove modal when clicking revoke', () => {
    render(
      <Contact
        contact={makeContact({ confirmed: false, userFrom: 'me' })}
        selfId="me"
      />,
    );

    fireEvent.click(screen.getByText('Revoke Request'));
    expect(screen.getByText('remove-modal-open')).toBeInTheDocument();
  });

  it('notifies the container when received-contact removal succeeds', () => {
    const onContactRemoved = jest.fn();
    render(
      <Contact
        contact={makeContact({
          confirmed: false,
          userFrom: 'someone-else',
          userTo: 'me',
        })}
        selfId="me"
        onContactRemoved={onContactRemoved}
      />,
    );

    fireEvent.click(screen.getByText('Decline Request'));
    fireEvent.click(screen.getByText('remove-success'));

    expect(onContactRemoved).toHaveBeenCalledTimes(1);
  });

  it('closes the remove modal when removal is cancelled', () => {
    render(
      <Contact
        contact={makeContact({ confirmed: false, userFrom: 'me' })}
        selfId="me"
      />,
    );

    fireEvent.click(screen.getByText('Revoke Request'));
    expect(screen.getByText('remove-modal-open')).toBeInTheDocument();

    fireEvent.click(screen.getByText('remove-cancel'));

    expect(screen.queryByText('remove-modal-open')).not.toBeInTheDocument();
  });

  it('uses a no-op removal callback when none is provided', () => {
    render(
      <Contact
        contact={makeContact({
          confirmed: false,
          userFrom: 'someone-else',
          userTo: 'me',
        })}
        selfId="me"
      />,
    );

    fireEvent.click(screen.getByText('Decline Request'));
    fireEvent.click(screen.getByText('remove-success'));

    expect(screen.queryByText('remove-modal-open')).not.toBeInTheDocument();
  });
});
