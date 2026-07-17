import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';

jest.mock('@/modules/contacts/client/api/contacts.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ contactId: 'contact-1' })),
}));
jest.mock('@/modules/users/client/components/Avatar.component', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockAvatar({ user }) {
    return <div>{user.displayName}</div>;
  }

  MockAvatar.propTypes = {
    user: PropTypes.object.isRequired,
  };

  return MockAvatar;
});

const user = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
  public: true,
};

const pendingContact = {
  _id: 'contact-1',
  confirmed: false,
  userFrom: {
    _id: 'user-2',
    username: 'bob',
    displayName: 'Bob Example',
  },
  userTo: {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
  },
};

describe('ContactConfirmPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ contactId: 'contact-1' });
    contactsApi.getByContactId.mockResolvedValue(pendingContact);
  });

  it('shows activation notice for non-public members', () => {
    render(<ContactConfirmPage user={{ ...user, public: false }} />);

    expect(
      screen.getByText(/activate your profile by confirming your email/i),
    ).toBeInTheDocument();
  });

  it('renders the confirm contact form and confirms the request', async () => {
    contactsApi.confirm.mockResolvedValue({});
    render(<ContactConfirmPage user={user} />);

    expect(await screen.findByText('Confirm contact')).toBeVisible();
    expect(screen.getAllByText('Bob Example').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm contact' }));

    await waitFor(() => {
      expect(contactsApi.confirm).toHaveBeenCalledWith('contact-1');
    });
    expect(await screen.findByText('You two are now connected!')).toBeVisible();
  });

  it('shows success when the contact is already confirmed', async () => {
    contactsApi.getByContactId.mockResolvedValue({
      ...pendingContact,
      confirmed: true,
    });
    render(<ContactConfirmPage user={user} />);

    expect(
      await screen.findByText('You two are already connected. Great!'),
    ).toBeVisible();
  });

  it('shows an error when the logged-in user is not the recipient', async () => {
    contactsApi.getByContactId.mockResolvedValue({
      ...pendingContact,
      userTo: { _id: 'someone-else', displayName: 'Someone Else' },
    });
    render(<ContactConfirmPage user={user} />);

    expect(
      await screen.findByText(
        'You must wait until they confirm your connection.',
      ),
    ).toBeVisible();
  });

  it('reports a missing contact request', async () => {
    contactsApi.getByContactId.mockRejectedValue({ response: { status: 404 } });
    render(<ContactConfirmPage user={user} />);

    expect(
      await screen.findByText(/Could not find contact request/),
    ).toBeVisible();
  });

  it('shows an error when the contact id is missing from the route', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ contactId: '' });

    render(<ContactConfirmPage user={user} />);

    expect(
      await screen.findByText('Something went wrong. Try again.'),
    ).toBeVisible();
  });

  it('reports confirmation failures', async () => {
    contactsApi.confirm.mockRejectedValue({
      response: { data: { message: 'Unable to confirm contact.' } },
    });
    render(<ContactConfirmPage user={user} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm contact' }),
    );

    expect(await screen.findByText('Unable to confirm contact.')).toBeVisible();
  });

  it('uses the generic message when confirmation failure has no response', async () => {
    contactsApi.confirm.mockRejectedValue(new Error('offline'));
    render(<ContactConfirmPage user={user} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm contact' }),
    );

    expect(
      await screen.findByText('Something went wrong. Try again.'),
    ).toBeVisible();
  });

  it('reports generic load failures', async () => {
    contactsApi.getByContactId.mockRejectedValue(new Error('network'));
    render(<ContactConfirmPage user={user} />);

    expect(
      await screen.findByText('Something went wrong. Try again.'),
    ).toBeVisible();
  });

  it('ignores a contact response after unmounting', async () => {
    let resolveContact;
    contactsApi.getByContactId.mockReturnValue(
      new Promise(resolve => {
        resolveContact = resolve;
      }),
    );

    const { unmount } = render(<ContactConfirmPage user={user} />);
    unmount();
    resolveContact(pendingContact);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores a load failure after unmounting', async () => {
    let rejectContact;
    contactsApi.getByContactId.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectContact = reject;
      }),
    );

    const { unmount } = render(<ContactConfirmPage user={user} />);
    unmount();
    rejectContact(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
