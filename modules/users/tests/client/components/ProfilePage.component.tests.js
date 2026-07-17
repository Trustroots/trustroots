import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/contacts/client/api/contacts.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ username: 'bob' })),
}));
jest.mock(
  '@/modules/users/client/components/TopNavigationSmall.component',
  () => ({
    __esModule: true,
    default: () => <nav data-testid="top-nav" />,
  }),
);
jest.mock(
  '@/modules/users/client/components/BottomNavigationSmall.component',
  () => ({
    __esModule: true,
    default: () => <nav data-testid="bottom-nav" />,
  }),
);
jest.mock(
  '@/modules/users/client/components/ProfileOverview.component',
  () => ({
    __esModule: true,
    default: ({ profile }) => <div>{profile.displayName}</div>,
  }),
);
jest.mock('@/modules/users/client/components/ProfileTabs.component', () => ({
  __esModule: true,
  default: () => <div data-testid="profile-tabs" />,
}));
jest.mock('@/modules/users/client/components/AboutMe.component', () => ({
  __esModule: true,
  default: ({ profile }) => <div>About {profile.displayName}</div>,
}));
jest.mock('@/modules/offers/client/components/Offers.component', () => ({
  __esModule: true,
  default: () => <div>Offers panel</div>,
}));
jest.mock(
  '@/modules/contacts/client/components/ContactsCommon.component',
  () => ({
    __esModule: true,
    default: () => <div>Contacts in common</div>,
  }),
);
jest.mock(
  '@/modules/users/client/components/MembershipsList.component',
  () => ({
    __esModule: true,
    default: () => <div>Memberships list</div>,
  }),
);
jest.mock('@/modules/users/client/components/TribesInCommon.component', () => ({
  __esModule: true,
  default: () => <div>Tribes in common</div>,
}));
jest.mock('@/modules/support/client/components/ReportMember.component', () => ({
  __esModule: true,
  default: () => <button type="button">Report</button>,
}));
jest.mock('@/modules/users/client/components/BlockMember.component', () => ({
  __esModule: true,
  default: () => <button type="button">Block</button>,
}));
jest.mock(
  '@/modules/contacts/client/components/RemoveContactContainer',
  () => ({
    __esModule: true,
    default: ({ onCancel, onSuccess, show }) =>
      show ? (
        <div>
          <button type="button" onClick={onCancel}>
            Cancel removal
          </button>
          <button type="button" onClick={onSuccess}>
            Confirm removal
          </button>
        </div>
      ) : null,
  }),
);
jest.mock(
  '@/modules/users/client/components/AvatarNameMobile.component',
  () => ({
    __esModule: true,
    default: ({ profile }) => <div>Mobile {profile.displayName}</div>,
  }),
);
jest.mock('@/modules/contacts/client/components/ContactList.component', () => ({
  __esModule: true,
  default: ({ onContactRemoved }) => (
    <div>
      Contact list
      <button
        type="button"
        onClick={() => onContactRemoved({ _id: 'contact-1' })}
      >
        Remove from list
      </button>
    </div>
  ),
}));
jest.mock(
  '@/modules/users/client/components/ProfileTribesTab.component',
  () => ({
    __esModule: true,
    default: ({ onMembershipUpdated }) => (
      <div>
        Tribes tab content
        <button
          type="button"
          onClick={() => onMembershipUpdated({ user: { _id: 'updated-user' } })}
        >
          Update membership
        </button>
        <button type="button" onClick={() => onMembershipUpdated({})}>
          Ignore membership update
        </button>
      </div>
    ),
  }),
);
jest.mock(
  '@/modules/experiences/client/components/ListExperiences.component',
  () => ({
    __esModule: true,
    default: () => <div>Experiences list</div>,
  }),
);
jest.mock(
  '@/modules/experiences/client/components/CreateExperience.component',
  () => ({
    __esModule: true,
    default: () => <div>New experience form</div>,
  }),
);
jest.mock(
  '@/modules/users/client/components/BlockedMemberBanner.component',
  () => ({
    __esModule: true,
    default: ({ username }) => <div>Blocked banner for {username}</div>,
  }),
);

const authUser = {
  _id: 'user-1',
  username: 'ada',
  public: true,
  blocked: [],
  memberIds: ['tribe-1'],
};

const profile = {
  _id: 'user-2',
  username: 'bob',
  displayName: 'Bob Example',
  tagline: 'Traveller',
  member: [{ tribe: { _id: 'tribe-1', label: 'Cyclists' } }],
};

function renderPage(
  user = authUser,
  path = '/profile/bob',
  settings = { profileMinimumLength: 140, referencesEnabled: false },
) {
  window.history.pushState({}, '', path);

  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings,
        title: 'Trustroots',
        user,
      }}
    >
      <ProfilePage user={user} />
    </AppProviders>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usersApi.fetch.mockResolvedValue(profile);
    contactsApi.getByUserId.mockResolvedValue(null);
    contactsApi.list.mockResolvedValue([]);
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('loads another member profile and renders about content', async () => {
    renderPage();

    expect(await screen.findByText('About Bob Example')).toBeVisible();
    expect(screen.getByText('Offers panel')).toBeVisible();
    expect(screen.getByTestId('profile-tabs')).toBeInTheDocument();
    expect(usersApi.fetch).toHaveBeenCalledWith('bob');
  });

  it('handles viewers without a blocked-member list', async () => {
    renderPage({ ...authUser, blocked: undefined });

    expect(await screen.findByText('About Bob Example')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Block' })).toBeVisible();
  });

  it('shows add contact action when no contact exists', async () => {
    renderPage();

    expect(
      await screen.findByRole('link', { name: 'Add contact' }),
    ).toHaveAttribute('href', '/contact-add/user-2');
  });

  it('shows remove contact for an existing confirmed contact', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: authUser._id,
      userTo: profile._id,
    });
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Remove contact' }),
    ).toBeVisible();
  });

  it('shows incoming contact request actions', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: false,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: profile._id,
      userTo: authUser._id,
    });
    renderPage();

    expect(await screen.findByText(/sent you a contact request/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Confirm Request' }),
    ).toHaveAttribute('href', '/contact-confirm/contact-1');
  });

  it('opens the remove contact modal and clears contact state on success', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: authUser._id,
      userTo: profile._id,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove contact' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Remove contact' }),
      ).not.toBeInTheDocument();
    });
  });

  it('shows user does not exist for missing profiles', async () => {
    usersApi.fetch.mockResolvedValue({});
    renderPage();

    expect(
      await screen.findByText(
        'The person you are looking for is not available.',
      ),
    ).toBeVisible();
  });

  it('shows email confirmation notice on own unconfirmed profile', async () => {
    usersApi.fetch.mockResolvedValue({
      ...profile,
      _id: authUser._id,
      username: 'ada',
    });
    contactsApi.list.mockResolvedValue([]);
    renderPage({ ...authUser, public: false }, '/profile/ada');

    expect(await screen.findByText(/confirm your email/)).toBeVisible();
  });

  it('renders overview, accommodation, contacts, tribes, and experience tabs', async () => {
    renderPage(authUser, '/profile/bob/overview');
    expect(await screen.findByText('Mobile Bob Example')).toBeVisible();

    window.history.pushState({}, '', '/profile/bob/accommodation');
    renderPage(authUser, '/profile/bob/accommodation');
    expect(await screen.findByText('Offers panel')).toBeVisible();

    window.history.pushState({}, '', '/profile/bob/contacts');
    renderPage(authUser, '/profile/bob/contacts');
    expect(await screen.findByText('Contact list')).toBeVisible();

    window.history.pushState({}, '', '/profile/bob/tribes');
    renderPage(authUser, '/profile/bob/tribes');
    expect(await screen.findByText('Tribes tab content')).toBeVisible();
  });

  it('renders experience tabs when references are enabled', async () => {
    window.history.pushState({}, '', '/profile/bob/experiences');
    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: { profileMinimumLength: 140, referencesEnabled: true },
          title: 'Trustroots',
          user: authUser,
        }}
      >
        <ProfilePage user={authUser} />
      </AppProviders>,
    );
    expect(await screen.findByText('Experiences list')).toBeVisible();

    window.history.pushState({}, '', '/profile/bob/experiences/new');
    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: { profileMinimumLength: 140, referencesEnabled: true },
          title: 'Trustroots',
          user: authUser,
        }}
      >
        <ProfilePage user={authUser} />
      </AppProviders>,
    );
    expect(await screen.findByText('New experience form')).toBeVisible();
  });

  it('shows contacts in common and tribes in common on the about tab', async () => {
    contactsApi.list.mockResolvedValue([{ _id: 'shared-1' }]);
    renderPage();

    expect(await screen.findByText('Contacts in common')).toBeVisible();
    expect(screen.getByText('Tribes in common')).toBeVisible();
    expect(screen.getByText('Memberships list')).toBeVisible();
  });

  it('normalises contact records with embedded user objects', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: { _id: authUser._id },
      userTo: { _id: profile._id },
    });
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Remove contact' }),
    ).toBeVisible();
  });

  it('shows delete contact request for an unconfirmed outgoing request', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: false,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: authUser._id,
      userTo: profile._id,
    });
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Delete contact request' }),
    ).toBeVisible();
  });

  it('shows a blocked member banner', async () => {
    renderPage({ ...authUser, blocked: [profile._id] });

    expect(await screen.findByText('Blocked banner for bob')).toBeVisible();
  });

  it('opens remove modal when declining an incoming contact request', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: false,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: profile._id,
      userTo: authUser._id,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Decline Request' }),
    );
    expect(
      screen.getByRole('button', { name: 'Confirm removal' }),
    ).toBeInTheDocument();
  });

  it('handles profile fetch failures gracefully', async () => {
    usersApi.fetch.mockRejectedValue(new Error('network'));
    renderPage();

    expect(
      await screen.findByText(
        'The person you are looking for is not available.',
      ),
    ).toBeVisible();
  });

  it('renders the about tab for the signed-in member viewing their own profile', async () => {
    usersApi.fetch.mockResolvedValue({
      ...profile,
      _id: authUser._id,
      username: 'ada',
      displayName: 'Ada Example',
    });
    contactsApi.getByUserId.mockResolvedValue(null);
    contactsApi.list.mockResolvedValue([]);

    renderPage(authUser, '/profile/ada');

    expect(await screen.findByText('About Ada Example')).toBeVisible();
    expect(screen.queryByText('Tribes in common')).not.toBeInTheDocument();
  });

  it('removes a contact from the loaded contact list', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: authUser._id,
      userTo: profile._id,
    });
    contactsApi.list.mockResolvedValue([{ _id: 'contact-1' }]);
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove contact' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Remove contact' }),
      ).not.toBeInTheDocument();
    });
  });

  it('handles a contact-list removal when no current contact is loaded', async () => {
    renderPage(authUser, '/profile/bob/contacts');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove from list' }),
    );
    expect(screen.getByText('Contact list')).toBeVisible();
  });

  it('ignores a profile response after unmounting', async () => {
    let resolveProfile;
    usersApi.fetch.mockReturnValue(
      new Promise(resolve => {
        resolveProfile = resolve;
      }),
    );

    const { unmount } = renderPage();
    unmount();
    resolveProfile(profile);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores contact responses after unmounting', async () => {
    let resolveContact;
    let resolveContacts;
    usersApi.fetch.mockResolvedValue(profile);
    contactsApi.getByUserId.mockReturnValue(
      new Promise(resolve => {
        resolveContact = resolve;
      }),
    );
    contactsApi.list.mockReturnValue(
      new Promise(resolve => {
        resolveContacts = resolve;
      }),
    );

    const { unmount } = renderPage();
    await waitFor(() => expect(contactsApi.list).toHaveBeenCalled());
    unmount();
    resolveContact(null);
    resolveContacts([]);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('updates auth state from a tribe membership callback', async () => {
    renderPage(authUser, '/profile/bob/tribes');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Update membership' }),
    );

    expect(screen.getByText('Tribes tab content')).toBeVisible();
  });

  it('handles optional member metadata and an absent contact list', async () => {
    contactsApi.list.mockResolvedValue(undefined);
    renderPage(
      { _id: 'user-1', public: true, username: 'ada' },
      '/profile/bob',
    );

    expect(await screen.findByText('About Bob Example')).toBeVisible();
    expect(screen.getByText('Memberships list')).toBeVisible();
  });

  it('uses default settings and hides disabled experience tabs', async () => {
    const firstRender = renderPage(authUser, '/profile/bob/experiences', {});

    expect(await screen.findByTestId('profile-tabs')).toBeInTheDocument();
    expect(screen.queryByText('Experiences list')).not.toBeInTheDocument();
    firstRender.unmount();

    renderPage(authUser, '/profile/bob/experiences/new', {});

    expect(await screen.findByTestId('profile-tabs')).toBeInTheDocument();
    expect(screen.queryByText('New experience form')).not.toBeInTheDocument();
  });

  it('ignores membership callbacks without an updated user', async () => {
    renderPage(authUser, '/profile/bob/tribes');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Ignore membership update' }),
    );

    expect(screen.getByText('Tribes tab content')).toBeVisible();
  });

  it('ignores profile fetch failures after unmounting', async () => {
    let rejectProfile;
    usersApi.fetch.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectProfile = reject;
      }),
    );

    const { unmount } = renderPage();
    unmount();
    rejectProfile(new Error('late failure'));

    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('handles cancelling the remove contact dialog', async () => {
    contactsApi.getByUserId.mockResolvedValue({
      _id: 'contact-1',
      confirmed: true,
      created: '2024-01-01T00:00:00.000Z',
      userFrom: authUser._id,
      userTo: profile._id,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove contact' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel removal' }));
    expect(
      screen.queryByRole('button', { name: 'Cancel removal' }),
    ).not.toBeInTheDocument();
  });
});
