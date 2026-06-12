import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import RemoveContact from '@/modules/contacts/client/components/RemoveContact';

function makeContact(overrides = {}) {
  return {
    confirmed: true,
    created: '2020-01-01T00:00:00.000Z',
    userFrom: 'me',
    ...overrides,
  };
}

function renderRemoveContact(props = {}) {
  const { contact, ...restProps } = props;

  return render(
    <RemoveContact
      contact={makeContact(contact)}
      show={true}
      inProgress={false}
      selfId="me"
      onCancel={jest.fn()}
      onRemove={jest.fn()}
      {...restProps}
    />,
  );
}

describe('<RemoveContact />', () => {
  it('renders confirmed-contact removal copy and calls handlers', () => {
    const onCancel = jest.fn();
    const onRemove = jest.fn();

    renderRemoveContact({ onCancel, onRemove });

    expect(screen.getByText('Remove contact?')).toBeInTheDocument();
    expect(
      screen.getByText('Connected since January 1, 2020'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Yes, remove contact' }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders revoke copy for unconfirmed requests sent by self', () => {
    renderRemoveContact({
      contact: {
        confirmed: false,
        userFrom: 'me',
      },
    });

    expect(screen.getByText('Revoke contact request?')).toBeInTheDocument();
    expect(screen.getByText('Requested January 1, 2020')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Yes, revoke request' }),
    ).toBeInTheDocument();
  });

  it('renders decline copy for unconfirmed requests sent by someone else', () => {
    renderRemoveContact({
      contact: {
        confirmed: false,
        userFrom: 'them',
      },
    });

    expect(screen.getByText('Decline contact request?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Yes, decline request' }),
    ).toBeInTheDocument();
  });

  it('disables actions and shows progress while removal is pending', () => {
    renderRemoveContact({ inProgress: true });

    expect(screen.queryByRole('button', { name: '×' })).not.toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment…');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Wait a moment…' }),
    ).toBeDisabled();
  });
});
