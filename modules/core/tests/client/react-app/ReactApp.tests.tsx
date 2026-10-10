import React from 'react';
import { AxiosHeaders } from 'axios';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import {
  AppProviders,
  type BootstrapData,
} from '@/modules/core/client/react-app/AppProviders';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as messagesApi from '@/modules/messages/client/api/messages.api';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import { REACT_ROUTE_POLICIES } from '@/modules/core/shared/react-route-ownership';
import type { Message } from '@/modules/messages/client/api/messages.api';
import type { Offer } from '@/modules/offers/client/api/offers.api';

const mockedUsersApi = jest.mocked(usersApi);
const mockedMessagesApi = jest.mocked(messagesApi);
const mockedOffersApi = jest.mocked(offersApi);

jest.mock('@/modules/admin/client/components/Admin.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdmin() {
    return <main>Admin route</main>;
  }

  return MockAdmin;
});

jest.mock('@/modules/admin/client/components/AdminAuditLog.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdminAuditLog() {
    return <main>Admin audit route</main>;
  }

  return MockAdminAuditLog;
});

jest.mock(
  '@/modules/admin/client/components/AdminAcquisitionStories.component',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockAdminAcquisitionStories() {
      return <main>Admin acquisition stories route</main>;
    }

    return MockAdminAcquisitionStories;
  },
);

jest.mock('@/modules/admin/client/components/AdminCircles.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdminCircles() {
    return <main>Admin circles route</main>;
  }

  return MockAdminCircles;
});
jest.mock('@/modules/admin/client/components/AdminMessages.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdminMessages() {
    return <main>Admin messages route</main>;
  }

  return MockAdminMessages;
});

jest.mock('@/modules/admin/client/components/AdminNewsletter.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdminNewsletter() {
    return <main>Admin newsletter route</main>;
  }

  return MockAdminNewsletter;
});

jest.mock(
  '@/modules/admin/client/components/AdminReferenceThreads.component',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockAdminReferenceThreads() {
      return <main>Admin reference threads route</main>;
    }

    return MockAdminReferenceThreads;
  },
);

jest.mock(
  '@/modules/admin/client/components/AdminSearchUsers.component',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockAdminSearchUsers() {
      return <main>Admin search users route</main>;
    }

    return MockAdminSearchUsers;
  },
);

jest.mock('@/modules/admin/client/components/AdminThreads.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdminThreads() {
    return <main>Admin threads route</main>;
  }

  return MockAdminThreads;
});

jest.mock('@/modules/admin/client/components/AdminUser.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAdminUser() {
    return <main>Admin user route</main>;
  }

  return MockAdminUser;
});

jest.mock('@/modules/pages/client/components/Rules.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockRules() {
    return <main>Rules route</main>;
  }

  return MockRules;
});

jest.mock('@/modules/support/client/components/SupportPage.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockSupportPage({ user }: { user?: AuthUser | null }) {
    return (
      <main>
        <span>Support route {user?.username}</span>
        <span>Query {global.location.search}</span>
      </main>
    );
  }

  return MockSupportPage;
});

jest.mock('@/modules/core/client/components/AppHeader.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAppHeader({
    user,
    onSignout,
  }: {
    user?: AuthUser | null;
    onSignout?: () => void;
  }) {
    return (
      <header>
        Header {user?.username || 'guest'}
        <button type="button" onClick={onSignout}>
          Sign out
        </button>
      </header>
    );
  }

  return MockAppHeader;
});

jest.mock('@/modules/core/client/react-app/ReactFooter', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockReactFooter() {
    return <footer>Footer</footer>;
  }

  return MockReactFooter;
});

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/offers/client/api/offers.api');
jest.mock('@/modules/contacts/client/api/contacts.api', () => ({
  getByUserId: jest.fn(async () => null),
  list: jest.fn(async () => []),
}));

/* eslint-disable react/display-name, react/prop-types -- unrelated presentation is stubbed; page state and routing are real. */
jest.mock(
  '@/modules/messages/client/components/ThreadReply',
  () =>
    ({ onSend }: { onSend: (content: string) => void }) =>
      (
        <button type="button" onClick={() => onSend('A fictional message')}>
          Send message
        </button>
      ),
);
jest.mock(
  '@/modules/messages/client/components/ThreadMessages',
  () =>
    ({ otherUser }: { otherUser: { username: string } }) =>
      <div>Conversation with {otherUser.username}</div>,
);
jest.mock('@/modules/users/client/components/Monkeybox', () => () => null);
jest.mock(
  '@/modules/references-thread/client/components/ReferenceThread',
  () => () => null,
);
jest.mock(
  '@/modules/users/client/components/ProfileOverview.component',
  () => () => null,
);
jest.mock(
  '@/modules/users/client/components/AboutMe.component',
  () =>
    ({ profile }: { profile: { description?: string } }) =>
      <p>{profile.description}</p>,
);
jest.mock(
  '@/modules/search/client/components/SearchPlaceInput.component',
  () => () => null,
);
jest.mock(
  '@/modules/search/client/components/SearchSidebar.component',
  () =>
    ({
      offer,
      onCloseSidebar,
    }: {
      offer?: Offer | null;
      onCloseSidebar: () => void;
    }) =>
      (
        <aside>
          {offer && <span>Selected offer {offer._id}</span>}
          <button type="button" onClick={onCloseSidebar}>
            Close search sidebar
          </button>
        </aside>
      ),
);
const mockMapMount = jest.fn();
const mockOffer: Offer = {
  _id: '665100000000000000000001',
  location: [10, 20],
};
jest.mock('@/modules/search/client/components/SearchMap.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return ({
    onOfferOpen,
    location,
  }: {
    onOfferOpen: (offer: Offer) => void;
    location: { zoom?: number };
  }) => {
    React.useEffect(() => {
      mockMapMount();
    }, []);
    return (
      <div>
        <button type="button" onClick={() => onOfferOpen(mockOffer)}>
          Open map pin
        </button>
        <span>Requested zoom {location.zoom || 'unchanged'}</span>
      </div>
    );
  };
});
/* eslint-enable react/display-name, react/prop-types */

function UpdateUser() {
  const { user, setUser } = useAuth();
  return (
    <button
      type="button"
      onClick={() => setUser({ ...user, username: 'member-after' })}
    >
      Save user changes
    </button>
  );
}

describe('<ReactApp />', () => {
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    window.scrollTo = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
  });

  function renderApp(
    path: string,
    bootstrapData: Partial<BootstrapData> = {},
    props: React.ComponentProps<typeof ReactApp> = {},
  ) {
    window.history.pushState({}, '', path);

    return render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
          ...bootstrapData,
        }}
      >
        <ReactApp {...props} />
        <UpdateUser />
      </AppProviders>,
    );
  }

  it('renders a React-owned route and updates the document title', async () => {
    renderApp('/rules');

    expect(await screen.findByText('Rules route')).toBeInTheDocument();
    expect(screen.getByText('Header guest')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(document.title).toBe('Rules - Trustroots');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('passes bootstrap user data to route and shell components', async () => {
    renderApp('/support?report=alice', {
      user: {
        username: 'bob',
      },
    });

    expect(await screen.findByText('Support route bob')).toBeInTheDocument();
    expect(screen.getByText('Header bob')).toBeInTheDocument();
  });

  it('renders admin routes for admin users and shows the admin footer', async () => {
    renderApp('/admin/audit-log', {
      user: {
        roles: ['user', 'admin'],
        username: 'admin',
      },
    });

    expect(await screen.findByText('Admin audit route')).toBeInTheDocument();
    expect(screen.getByText('Header admin')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(document.title).toBe('Admin - Audit log - Trustroots');
  });

  it('honors headerHidden and noScrollingTop route metadata', async () => {
    const route = REACT_ROUTE_POLICIES.find(route => route.path === '/rules')!;
    route.headerHidden = true;
    route.noScrollingTop = true;

    try {
      renderApp('/rules');

      expect(await screen.findByText('Rules route')).toBeInTheDocument();
      expect(screen.queryByText('Header guest')).not.toBeInTheDocument();
      expect(window.scrollTo).not.toHaveBeenCalled();
    } finally {
      delete route.headerHidden;
      delete route.noScrollingTop;
    }
  });

  it('defensively redirects guests away from protected routes', async () => {
    const navigate = jest.fn();

    renderApp('/admin', {}, { navigate });

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/signin?continue=true&returnTo=%2Fadmin',
      ),
    );
    expect(screen.queryByText('Admin route')).not.toBeInTheDocument();
  });

  it('defensively redirects non-admin users away from admin routes', async () => {
    const navigate = jest.fn();

    renderApp(
      '/admin',
      {
        user: {
          roles: ['user'],
          username: 'member',
        },
      },
      { navigate },
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/volunteering'));
    expect(screen.queryByText('Admin route')).not.toBeInTheDocument();
  });

  it('redirects legacy routes to their replacement', async () => {
    const navigate = jest.fn();

    renderApp('/about', {}, { navigate });

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('routes ordinary React-owned links through client navigation', async () => {
    const navigate = jest.fn();
    renderApp('/rules', {}, { navigate });
    await screen.findByText('Rules route');
    const link = document.createElement('a');
    link.href = '/faq?topic=routes';
    link.textContent = 'FAQ';
    document.body.appendChild(link);

    try {
      fireEvent.click(link);
      expect(navigate).toHaveBeenCalledWith('/faq?topic=routes');
    } finally {
      link.remove();
    }
  });

  it('remounts the current route when client navigation changes its query', async () => {
    renderApp('/support?report=alice');
    const link = document.createElement('a');
    link.href = '/support?report=bob';
    link.textContent = 'Change report';
    document.body.appendChild(link);

    try {
      expect(
        await screen.findByText('Query ?report=alice'),
      ).toBeInTheDocument();
      fireEvent.click(link);
      await waitFor(() =>
        expect(window.location.pathname + window.location.search).toBe(
          '/support?report=bob',
        ),
      );
      await screen.findByText('Query ?report=bob');
      expect(window.location.pathname + window.location.search).toBe(
        '/support?report=bob',
      );
    } finally {
      link.remove();
    }
  });

  it('leaves links outside React route ownership to the browser', async () => {
    const navigate = jest.fn();
    renderApp('/rules', {}, { navigate });
    await screen.findByText('Rules route');
    const link = document.createElement('a');
    link.href = '/api/auth/signout';
    link.textContent = 'Sign out';
    document.body.appendChild(link);

    try {
      fireEvent.click(link);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      link.remove();
    }
  });

  it('redirects unmatched paths to the not-found route', async () => {
    const navigate = jest.fn();

    renderApp('/missing-react-route', {}, { navigate });

    expect(
      await screen.findByText(/this page cannot be found/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Header guest')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/not-found'));
  });
  it('sends to the new recipient after direct conversation navigation', async () => {
    const user: AuthUser & { _id: string; username: string } = {
      _id: 'sender',
      username: 'sender',
      public: true,
      description: 'Fictional profile',
    };
    mockedUsersApi.fetch.mockImplementation(async (username: string) => ({
      _id: `${username}-id`,
      displayName: 'Fictional member',
      username,
    }));
    const messagesResponse = {
      messages: [
        {
          _id: 'message-one',
          content: 'A fictional message',
          created: '2026-01-01',
          read: true,
          userFrom: user,
          userTo: {
            _id: 'member-one-id',
            username: 'member-one',
          },
        },
      ],
      // Preserve the API's explicit terminal null cursor at this mock boundary.
      nextParams: null as unknown as Awaited<
        ReturnType<typeof messagesApi.fetchMessages>
      >['nextParams'],
    };
    mockedMessagesApi.fetchMessages.mockResolvedValue(messagesResponse);
    const sentMessage: Message = {
      _id: 'message-two',
      content: 'A fictional message',
      created: '2026-01-02',
      read: false,
      userFrom: user,
      userTo: { _id: 'member-two-id', username: 'member-two' },
    };
    mockedMessagesApi.sendMessage.mockResolvedValue({
      config: { headers: new AxiosHeaders() },
      data: sentMessage,
      headers: new AxiosHeaders(),
      status: 200,
      statusText: 'OK',
    });
    renderApp('/messages/member-one', { user });
    await screen.findByText('Conversation with member-one');
    const link = document.createElement('a');
    link.href = '/messages/member-two';
    document.body.appendChild(link);
    try {
      fireEvent.click(link);
      await screen.findByText('Conversation with member-two');
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      await waitFor(() =>
        expect(mockedMessagesApi.sendMessage).toHaveBeenCalledWith(
          'member-two-id',
          'A fictional message',
        ),
      );
    } finally {
      link.remove();
    }
  });

  it('keeps the map mounted and its zoom unchanged when opening and closing a pin', async () => {
    mockedOffersApi.getOffer.mockResolvedValue(mockOffer);
    renderApp('/search', {
      user: { _id: 'viewer', username: 'viewer', public: true },
    });
    await screen.findByText('Requested zoom unchanged');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open map pin' }));
    });
    await screen.findByText(`Selected offer ${mockOffer._id}`);
    await waitFor(() =>
      expect(window.location.search).toBe(`?offer=${mockOffer._id}`),
    );
    expect(screen.getByText('Requested zoom unchanged')).toBeInTheDocument();
    expect(mockMapMount).toHaveBeenCalledTimes(1);
    expect(mockedOffersApi.getOffer).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close search sidebar' }),
    );
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(mockMapMount).toHaveBeenCalledTimes(1);
  });

  it('loads an offer from client navigation without recreating the map', async () => {
    mockedOffersApi.getOffer.mockResolvedValue(mockOffer);
    renderApp('/search', {
      user: { _id: 'viewer', username: 'viewer', public: true },
    });
    await screen.findByText('Requested zoom unchanged');
    await act(async () => {
      window.history.pushState({}, '', `/search?offer=${mockOffer._id}`);
    });
    await screen.findByText(`Selected offer ${mockOffer._id}`);
    expect(screen.getByText('Requested zoom 13')).toBeInTheDocument();
    expect(mockMapMount).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.history.replaceState({}, '', '/search');
    });
    await waitFor(() =>
      expect(
        screen.queryByText(`Selected offer ${mockOffer._id}`),
      ).not.toBeInTheDocument(),
    );
    expect(mockMapMount).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed offer IDs supplied by client navigation', async () => {
    renderApp('/search', {
      user: { _id: 'viewer', username: 'viewer', public: true },
    });
    await screen.findByText('Requested zoom unchanged');
    await act(async () => {
      window.history.pushState({}, '', '/search?offer=invalid');
    });
    expect(mockedOffersApi.getOffer).not.toHaveBeenCalled();
    expect(mockMapMount).toHaveBeenCalledTimes(1);
  });

  it('allows opening About from mobile profile Overview', async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 390;
    mockedUsersApi.fetch.mockResolvedValue({
      _id: 'member-one',
      displayName: 'Member One',
      username: 'member-one',
      description: 'A fictional member description',
      member: [],
    });
    try {
      renderApp('/profile/member-one/overview', {
        user: { _id: 'viewer', username: 'viewer', public: true },
      });
      fireEvent.click(await screen.findByRole('tab', { name: 'About' }));
      await screen.findByText('A fictional member description');
      expect(window.location.pathname).toBe('/profile/member-one/about');
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it('preserves the loaded profile when switching tabs through the router', async () => {
    mockedUsersApi.fetch.mockResolvedValue({
      _id: 'member-one',
      displayName: 'Member One',
      username: 'member-one',
      description: 'A fictional member description',
      member: [],
    });
    renderApp('/profile/member-one', {
      user: { _id: 'member-one', username: 'member-one', public: true },
    });
    await screen.findByText('A fictional member description');

    fireEvent.click(
      document.querySelector(
        '.profile-tabs a[href="/profile/member-one/contacts"]',
      )!,
    );
    await waitFor(() =>
      expect(window.location.pathname).toBe('/profile/member-one/contacts'),
    );
    expect(screen.queryByText('Wait a moment…')).not.toBeInTheDocument();
    expect(mockedUsersApi.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(
      document.querySelector('.profile-tabs a[href="/profile/member-one"]')!,
    );
    await screen.findByText('A fictional member description');
    expect(mockedUsersApi.fetch).toHaveBeenCalledTimes(1);
  });

  it('updates the current page and header immediately when user state changes', async () => {
    renderApp('/support', { user: { username: 'member-before' } });
    await screen.findByText('Support route member-before');
    fireEvent.click(screen.getByRole('button', { name: 'Save user changes' }));
    await screen.findByText('Support route member-after');
    expect(screen.getByText('Header member-after')).toBeInTheDocument();
  });
});
