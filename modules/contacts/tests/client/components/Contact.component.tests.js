import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Contact from '@/modules/contacts/client/components/Contact';

jest.mock('@/modules/contacts/client/components/RemoveContactContainer', () => {
  const React = require('react');
  function MockRemoveContact({ show, onCancel, onSuccess }) {
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

function makeContact(overrides = {}) {
  return {
    _id: 'contact-1',
    confirmed: true,
    created: '2020-01-01T00:00:00.000Z',
    userFrom: 'me',
    userTo: 'them',
    user: {
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
