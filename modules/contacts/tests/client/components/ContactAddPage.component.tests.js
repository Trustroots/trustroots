import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { QueryClient, QueryClientProvider } from 'react-query';

import '@/config/client/i18n';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/contacts/client/api/contacts.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ userId: 'friend-1' })),
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
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockTrEditor({ onChange, text }) {
    return (
      <textarea
        aria-label="Contact message"
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }

  MockTrEditor.propTypes = {
    onChange: PropTypes.func,
    text: PropTypes.string,
  };

  return MockTrEditor;
});

const user = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
  public: true,
};

const friend = {
  _id: 'friend-1',
  username: 'bob',
  displayName: 'Bob Example',
};

function renderContactAddPage(pageUser = user) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ContactAddPage user={pageUser} />
    </QueryClientProvider>,
  );
}

describe('ContactAddPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ userId: 'friend-1' });
    usersApi.fetchMini.mockResolvedValue(friend);
    contactsApi.getByUserId.mockResolvedValue(null);
  });

  it('shows activation notice for non-public members', () => {
    renderContactAddPage({ ...user, public: false });

    expect(
      screen.getByText(/activate your profile by confirming your email/i),
    ).toBeInTheDocument();
  });

  it('renders the add contact form and submits a request', async () => {
    contactsApi.create.mockResolvedValue({});
    renderContactAddPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Edit message for Bob Example:',
      }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Bob Example')).length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));

    await waitFor(() => {
      expect(contactsApi.create).toHaveBeenCalledWith({
        friendUserId: 'friend-1',
        message: expect.stringContaining('Ada Example'),
      });
    });
    expect(
      await screen.findByText(/Done! We sent an email to your contact/),
    ).toBeVisible();
  });

  it('reports when the user tries to connect with themselves', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ userId: user._id });

    renderContactAddPage();

    expect(
      await screen.findByText(
        'You cannot connect with yourself. That is just silly!',
      ),
    ).toBeVisible();
  });

  it('shows success when a contact already exists', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
    });
    renderContactAddPage();

    expect(
      await screen.findByText('You two are already connected. Great!'),
    ).toBeVisible();
  });

  it('shows a pending connection message for unconfirmed contacts', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: false,
    });
    renderContactAddPage();

    expect(
      await screen.findByText(
        'Connection already initiated; now it has to be confirmed.',
      ),
    ).toBeVisible();
  });

  it('reports when the target member does not exist', async () => {
    usersApi.fetchMini.mockRejectedValue(new Error('not found'));
    renderContactAddPage();

    expect(await screen.findByText('User does not exist.')).toBeVisible();
  });

  it('handles duplicate contact responses from the API', async () => {
    contactsApi.create.mockRejectedValue({
      response: {
        status: 409,
        data: { confirmed: false },
      },
    });
    renderContactAddPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Edit message for Bob Example:',
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));

    expect(
      await screen.findByText(
        'Connection already initiated; now it has to be confirmed.',
      ),
    ).toBeVisible();
  });

  it('shows a generic error when contact creation fails', async () => {
    contactsApi.create.mockRejectedValue({
      response: { data: { message: 'Unable to add contact.' } },
    });
    renderContactAddPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Edit message for Bob Example:',
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));

    expect(await screen.findByText('Unable to add contact.')).toBeVisible();
  });

  it('handles confirmed duplicate and message-less failures', async () => {
    contactsApi.create
      .mockRejectedValueOnce({
        response: { status: 409, data: { confirmed: true } },
      })
      .mockRejectedValueOnce(new Error('network'));
    const firstRender = renderContactAddPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Edit message for Bob Example:',
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    expect(
      await screen.findByText('You two are already connected. Great!'),
    ).toBeVisible();

    firstRender.unmount();
    renderContactAddPage();
    await screen.findByRole('heading', {
      name: 'Edit message for Bob Example:',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    expect(
      await screen.findByText('Something went wrong. Try again.'),
    ).toBeVisible();
  });

  it('ignores a friend response after unmounting', async () => {
    let resolveFriend;
    usersApi.fetchMini.mockReturnValue(
      new Promise(resolve => {
        resolveFriend = resolve;
      }),
    );

    const { unmount } = renderContactAddPage();
    unmount();
    resolveFriend(friend);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores an existing contact response after unmounting', async () => {
    let resolveContact;
    contactsApi.getByUserId.mockReturnValue(
      new Promise(resolve => {
        resolveContact = resolve;
      }),
    );

    const { unmount } = renderContactAddPage();
    await screen.findByRole('heading', {
      name: 'Edit message for Bob Example:',
    });
    unmount();
    resolveContact(null);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores contact creation failures after unmounting', async () => {
    let rejectCreation;
    contactsApi.create.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectCreation = reject;
      }),
    );
    const { unmount } = renderContactAddPage();

    await screen.findByRole('heading', {
      name: 'Edit message for Bob Example:',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    unmount();
    rejectCreation(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
