import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import TopNavigationSmall from '@/modules/users/client/components/TopNavigationSmall.component';

jest.mock('@/modules/contacts/client/components/RemoveContactContainer', () => {
  function MockRemoveContact({ show, onCancel, onSuccess }) {
    return show ? (
      <div role="dialog" aria-label="Remove contact">
        <button type="button" onClick={onSuccess}>
          Confirm remove
        </button>
        <button type="button" onClick={onCancel}>
          Cancel remove
        </button>
      </div>
    ) : null;
  }

  MockRemoveContact.propTypes = {
    onCancel: () => null,
    onSuccess: () => null,
    show: () => null,
  };

  return MockRemoveContact;
});

function renderNavigation(props = {}) {
  return render(
    <TopNavigationSmall
      contact={{}}
      isResolved
      onContactRemoved={jest.fn()}
      referencesEnabled
      selfId="me"
      userId="alice-id"
      username="alice"
      {...props}
    />,
  );
}

describe('<TopNavigationSmall />', () => {
  it('links own profile visitors to profile editing', () => {
    renderNavigation({
      contact: null,
      referencesEnabled: false,
      selfId: 'me',
      userId: 'me',
    });

    expect(
      screen.getByRole('link', { name: 'Edit your profile' }),
    ).toHaveAttribute('href', '/profile/edit');
    expect(
      screen.queryByRole('link', { name: 'Send a message' }),
    ).not.toBeInTheDocument();
  });

  it('renders messaging, experience, and add-contact links for another member', () => {
    renderNavigation();

    expect(
      screen.getByRole('link', { name: 'Send a message' }),
    ).toHaveAttribute('href', '/messages/alice');
    expect(
      screen.getByRole('link', { name: 'Share your experience' }),
    ).toHaveAttribute('href', '/profile/alice/experiences/new');
    expect(screen.getByRole('link', { name: 'Add contact' })).toHaveAttribute(
      'href',
      '/contact-add/alice-id',
    );
  });

  it('confirms contact removal and reports the normalized contact', () => {
    const onContactRemoved = jest.fn();
    const contact = {
      _id: 'contact-1',
      confirmed: true,
      userFrom: { _id: 'me' },
      userTo: { _id: 'alice-id' },
    };

    renderNavigation({ contact, onContactRemoved });

    fireEvent.click(screen.getByText('Remove contact'));
    expect(
      screen.getByRole('dialog', { name: 'Remove contact' }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }));

    expect(onContactRemoved).toHaveBeenCalledWith({
      _id: 'contact-1',
      confirmed: true,
      userFrom: 'me',
      userTo: 'alice-id',
    });
    expect(
      screen.queryByRole('dialog', { name: 'Remove contact' }),
    ).not.toBeInTheDocument();
  });

  it('uses delete-contact-request wording for pending contacts', () => {
    renderNavigation({
      contact: {
        _id: 'contact-1',
        confirmed: false,
        userFrom: 'me',
        userTo: 'alice-id',
      },
    });

    fireEvent.click(screen.getByText('Delete contact request'));

    expect(
      screen.getByRole('dialog', { name: 'Remove contact' }),
    ).toBeVisible();
  });
});
