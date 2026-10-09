import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from 'react-query';

import '@/config/client/i18n';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import type Avatar from '@/modules/users/client/components/Avatar.component';
import type TrEditor from '@/modules/core/client/components/TrEditor';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';

type AddPageProps = React.ComponentProps<typeof ContactAddPage>;
type PageUser = AddPageProps['user'];
type Friend = Awaited<ReturnType<typeof usersApi.fetchMini>>;
type ExistingContact = Awaited<ReturnType<typeof contactsApi.getByUserId>>;

const fetchMiniMock = jest.mocked(usersApi.fetchMini);
const getByUserIdMock = jest.mocked(contactsApi.getByUserId);
const createContactMock = jest.mocked(contactsApi.create);
const routeParamsMock = jest.mocked(getCurrentRouteParams);

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/contacts/client/api/contacts.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ userId: 'friend-1' })),
}));
jest.mock('@/modules/users/client/components/Avatar.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAvatar({ user }: React.ComponentProps<typeof Avatar>) {
    return <div>{user.displayName}</div>;
  }

  return MockAvatar;
});
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockTrEditor({
    onChange,
    text,
  }: React.ComponentProps<typeof TrEditor>) {
    return (
      <textarea
        aria-label="Contact message"
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }

  return MockTrEditor;
});

const user: PageUser = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
  public: true,
};

const friend: Friend = {
  _id: 'friend-1',
  username: 'bob',
  displayName: 'Bob Example',
};

function renderContactAddPage(pageUser: PageUser = user) {
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
    routeParamsMock.mockReturnValue({ userId: 'friend-1' });
    fetchMiniMock.mockResolvedValue(friend);
    getByUserIdMock.mockResolvedValue(null);
  });

  it('shows activation notice for non-public members', () => {
    renderContactAddPage({ ...user, public: false });

    expect(
      screen.getByText(/activate your profile by confirming your email/i),
    ).toBeInTheDocument();
  });

  it('renders the add contact form and submits a request', async () => {
    createContactMock.mockResolvedValue({ _id: 'contact-request-1' });
    renderContactAddPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Edit message for Bob Example:',
      }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Bob Example')).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(
        /you don't need to add someone as a contact to message them/i,
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));

    await waitFor(() => {
      expect(createContactMock).toHaveBeenCalledWith({
        friendUserId: 'friend-1',
        message: expect.stringContaining('Ada Example'),
      });
    });
    expect(
      await screen.findByText(/Done! We sent an email to your contact/),
    ).toBeVisible();
  });

  it('reports when the user tries to connect with themselves', async () => {
    routeParamsMock.mockReturnValue({ userId: user._id });

    renderContactAddPage();

    expect(
      await screen.findByText(
        'You cannot connect with yourself. That is just silly!',
      ),
    ).toBeVisible();
  });

  it('shows success when a contact already exists', async () => {
    getByUserIdMock.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
    });
    renderContactAddPage();

    expect(
      await screen.findByText('You two are already connected. Great!'),
    ).toBeVisible();
  });

  it('shows a pending connection message for unconfirmed contacts', async () => {
    getByUserIdMock.mockResolvedValue({
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
    fetchMiniMock.mockRejectedValue(new Error('not found'));
    renderContactAddPage();

    expect(await screen.findByText('User does not exist.')).toBeVisible();
  });

  it('handles duplicate contact responses from the API', async () => {
    createContactMock.mockRejectedValue({
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
    createContactMock.mockRejectedValue({
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
    createContactMock
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
    let resolveFriend!: (friend: Friend) => void;
    fetchMiniMock.mockReturnValue(
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
    let resolveContact!: (contact: ExistingContact) => void;
    getByUserIdMock.mockReturnValue(
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
    let rejectCreation!: (error: unknown) => void;
    createContactMock.mockReturnValue(
      new Promise<Awaited<ReturnType<typeof contactsApi.create>>>(
        (resolve, reject) => {
          rejectCreation = reject;
        },
      ),
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
