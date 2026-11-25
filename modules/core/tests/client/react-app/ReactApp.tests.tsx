import React from 'react';
import * as reactRouter from '@tanstack/react-router';
import { AxiosHeaders } from 'axios';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import '@/config/client/i18n';
import ReactApp from '@/layers/shell/client/ReactApp';
import { createAppRouter } from '@/layers/shell/client/router';
import { Route as rootRoute } from '@/layers/shell/client/routes/__root';
import { Route as RulesRoute } from '@/layers/shell/client/routes/rules';
import { AppProviders } from '@/layers/shell/client/AppProviders';
import type { BootstrapData } from '@/modules/core/client/react-app/app-context';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as messagesApi from '@/modules/messages/client/api/messages.api';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import type { Message } from '@/modules/messages/client/api/messages.api';
import type { Offer } from '@/modules/offers/client/api/offers.api';
import type { OfferReadPayload } from '@/modules/offers/shared/offer';

// Start renders the head in its document shell, which the tests leave out.
Object.assign(rootRoute.options, {
  shellComponent: ({ children }: React.PropsWithChildren) => (
    <>
      <reactRouter.HeadContent />
      {children}
    </>
  ),
});

const currentUrl = () =>
  window.location.pathname + window.location.search + window.location.hash;
const mockedUsersApi = vi.mocked(usersApi);
const mockedMessagesApi = vi.mocked(messagesApi);
const mockedOffersApi = vi.mocked(offersApi);

vi.mock('@tanstack/react-router', async () => ({
  __esModule: true,
  ...(await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )),
}));

vi.mock('@/modules/admin/client/components/Admin.component', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockAdmin() {
    return <main>Admin route</main>;
  }

  return { default: MockAdmin };
});

vi.mock(
  '@/modules/admin/client/components/AdminAuditLog.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminAuditLog() {
      return <main>Admin audit route</main>;
    }

    return { default: MockAdminAuditLog };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminAcquisitionStories.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminAcquisitionStories() {
      return <main>Admin acquisition stories route</main>;
    }

    return { default: MockAdminAcquisitionStories };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminCircles.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    const { useNavigate, useParams } = await vi.importActual<
      typeof import('@tanstack/react-router')
    >('@tanstack/react-router');

    function MockAdminCircles() {
      const { circle } = useParams({ strict: false });
      const navigate = useNavigate();
      return (
        <main>
          Admin circles route <span>{circle}</span>
          <button
            onClick={() => void navigate({ to: '/admin/circles/walkers' })}
          >
            Select Walkers
          </button>
        </main>
      );
    }

    return { default: MockAdminCircles };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminMessages.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminMessages() {
      return <main>Admin messages route</main>;
    }

    return { default: MockAdminMessages };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminNewsletter.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminNewsletter() {
      return <main>Admin newsletter route</main>;
    }

    return { default: MockAdminNewsletter };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminReferenceThreads.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminReferenceThreads() {
      return <main>Admin reference threads route</main>;
    }

    return { default: MockAdminReferenceThreads };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminSearchUsers.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminSearchUsers() {
      return <main>Admin search users route</main>;
    }

    return { default: MockAdminSearchUsers };
  },
);

vi.mock(
  '@/modules/admin/client/components/AdminThreads.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockAdminThreads() {
      return <main>Admin threads route</main>;
    }

    return { default: MockAdminThreads };
  },
);

vi.mock('@/modules/admin/client/components/AdminUser.component', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockAdminUser() {
    return <main>Admin user route</main>;
  }

  return { default: MockAdminUser };
});

vi.mock('@/modules/pages/client/components/Rules.component', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockRules() {
    return <main>Rules route</main>;
  }

  return { default: MockRules };
});

vi.mock(
  '@/modules/support/client/components/SupportPage.component',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    function MockSupportPage({ user }: { user?: AuthUser | null }) {
      return (
        <main>
          <span>Support route {user?.username}</span>
          <span>Query {global.location.search}</span>
        </main>
      );
    }

    return { default: MockSupportPage };
  },
);

vi.mock('@/layers/shell/client/components/AppHeader.component', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockAppHeader({ user }: { user?: AuthUser | null }) {
    return <header>Header {user?.username || 'guest'}</header>;
  }

  return { default: MockAppHeader };
});

vi.mock('@/layers/shell/client/ReactFooter', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockReactFooter() {
    return <footer>Footer</footer>;
  }

  return { default: MockReactFooter };
});

vi.mock('@/modules/users/client/api/users.api');
vi.mock('@/modules/messages/client/api/messages.api');
vi.mock('@/modules/core/client/hooks/use-media-query', async () => ({
  ...(await vi.importActual<object>(
    '@/modules/core/client/hooks/use-media-query',
  )),
  __esModule: true,
  default: () => true,
}));
vi.mock('@/modules/pages/client/components/HomeRoute', () => ({
  default: () => <main>Home route</main>,
}));
vi.mock('@/modules/offers/client/api/offers.api');
vi.mock('@/modules/tribes/client/api/tribes.api');
vi.mock('@/modules/contacts/client/api/contacts.api', () => ({
  getByUserId: vi.fn(async () => null),
  list: vi.fn(async () => []),
}));

/* eslint-disable react/display-name -- unrelated presentation is stubbed; page state and routing are real. */
vi.mock('@/modules/messages/client/components/ThreadReply', () => ({
  default: ({ onSend }: { onSend: (content: string) => void }) => (
    <button type="button" onClick={() => onSend('A fictional message')}>
      Send message
    </button>
  ),
}));
vi.mock('@/modules/messages/client/components/ThreadMessages', () => ({
  default: ({ otherUser }: { otherUser: { username: string } }) => (
    <div>Conversation with {otherUser.username}</div>
  ),
}));
vi.mock('@/modules/users/client/components/Monkeybox', () => ({
  default: () => null,
}));
vi.mock(
  '@/modules/references-thread/client/components/ReferenceThread',
  () => ({ default: () => null }),
);
vi.mock('@/modules/users/client/components/ProfileOverview.component', () => ({
  default: () => null,
}));
vi.mock('@/modules/users/client/components/AboutMe.component', () => ({
  default: ({ profile }: { profile: { description?: string } }) => (
    <p>{profile.description}</p>
  ),
}));
vi.mock('@/modules/core/client/components/SearchPlaceInput.component', () => ({
  default: () => null,
}));
vi.mock('@/modules/search/client/components/SearchSidebar.component', () => ({
  default: ({
    offer,
    onCloseSidebar,
  }: {
    offer?: Offer | null;
    onCloseSidebar: () => void;
  }) => (
    <aside>
      {offer && <span>Selected offer {offer._id}</span>}
      <button type="button" onClick={onCloseSidebar}>
        Close search sidebar
      </button>
    </aside>
  ),
}));
const mockMapMount = vi.fn();
const mockOffer: OfferReadPayload = {
  _id: '665100000000000000000001',
  type: 'meet',
  user: { _id: 'member-1', username: 'member' },
  location: [10, 20],
};
vi.mock('@/modules/search/client/components/SearchMap.component', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({
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
    },
  };
});
/* eslint-enable react/display-name */

function UpdateUser() {
  const { user, setUser } = useAuth();
  return (
    <>
      <button
        type="button"
        onClick={() => setUser({ ...user, username: 'member-after' })}
      >
        Save user changes
      </button>
      <button
        type="button"
        onClick={() => setUser({ ...user, roles: ['user'] })}
      >
        Drop admin role
      </button>
    </>
  );
}

describe('<ReactApp />', () => {
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    window.scrollTo = vi.fn();
    vi.clearAllMocks();
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

  function recordScrolls() {
    const paths: string[] = [];
    vi.mocked(window.scrollTo).mockImplementation(() => {
      paths.push(window.location.pathname);
    });
    return paths;
  }

  it('renders with the router that TanStack Start hydrated', async () => {
    const router = createAppRouter();
    renderApp('/rules', {}, { router });

    expect(await screen.findByText('Rules route')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/rules');
  });

  it('renders a React-owned route, sets its title and scrolls to the top', async () => {
    renderApp('/rules');

    expect(await screen.findByText('Rules route')).toBeInTheDocument();
    expect(screen.getByText('Header guest')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Rules - Trustroots'));
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 0, top: 0 }),
    );
  });

  it('scrolls to the element named by the URL fragment after the route renders', async () => {
    const target = document.createElement('div');
    target.id = 'rules-anchor';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    try {
      renderApp('/rules#rules-anchor');

      expect(await screen.findByText('Rules route')).toBeInTheDocument();
      await waitFor(() => expect(target.scrollIntoView).toHaveBeenCalled());
    } finally {
      target.remove();
    }
  });

  it('renders normally when the URL fragment matches no element', async () => {
    renderApp('/rules#missing-anchor');

    expect(await screen.findByText('Rules route')).toBeInTheDocument();
    expect(currentUrl()).toBe('/rules#missing-anchor');
  });

  it('scrolls to the top when the URL fragment is empty', async () => {
    renderApp('/rules#');

    expect(await screen.findByText('Rules route')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ left: 0, top: 0 }),
      ),
    );
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
    await waitFor(() =>
      expect(document.title).toBe('Admin - Audit log - Trustroots'),
    );
  });

  it('renders the admin circles page for an administrator', async () => {
    renderApp('/admin/circles', {
      user: { roles: ['user', 'admin'], username: 'admin' },
    });
    expect(await screen.findByText('Admin circles route')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Admin - Circles - Trustroots'),
    );
  });

  it('navigates to the selected circle editor with its slug', async () => {
    renderApp('/admin/circles', {
      user: { roles: ['user', 'admin'], username: 'admin' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Select Walkers' }),
    );
    expect(await screen.findByText('walkers')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Admin - Circle - Trustroots'),
    );
  });

  it('honors headerHidden and noScrollingTop route metadata', async () => {
    const staticData = RulesRoute.options.staticData!;
    staticData.headerHidden = true;
    staticData.noScrollingTop = true;
    const router = createAppRouter();

    try {
      renderApp('/support', {}, { router });
      await screen.findByText(/Support route/);
      const scrolledOn = recordScrolls();
      await act(() => router.navigate({ to: '/rules' }));

      expect(await screen.findByText('Rules route')).toBeInTheDocument();
      expect(screen.queryByText('Header guest')).not.toBeInTheDocument();

      await act(() => router.navigate({ to: '/faq' }));
      await waitFor(() => expect(scrolledOn).toEqual(['/faq']));
    } finally {
      delete staticData.headerHidden;
      delete staticData.noScrollingTop;
    }
  });

  it('keeps the scroll position when only the query changes', async () => {
    const router = createAppRouter();
    renderApp('/support', {}, { router });
    await screen.findByText(/Support route/);
    const scrolledOn = recordScrolls();

    await act(() =>
      router.navigate({ to: '/support', search: { report: 'alice' } }),
    );
    await act(() => router.navigate({ to: '/rules' }));

    expect(await screen.findByText('Rules route')).toBeInTheDocument();
    await waitFor(() => expect(scrolledOn).toEqual(['/rules']));
  });

  it('defensively redirects guests away from protected routes', async () => {
    renderApp('/admin');

    await waitFor(() =>
      expect(currentUrl()).toBe('/signin?continue=true&returnTo=%2Fadmin'),
    );
    expect(screen.queryByText('Admin route')).not.toBeInTheDocument();
  });

  it('preserves the removal fragment when guests need to sign in', async () => {
    renderApp('/profile/edit/account#remove');
    await waitFor(() =>
      expect(currentUrl()).toBe(
        '/signin?continue=true&returnTo=%2Fprofile%2Fedit%2Faccount%23remove',
      ),
    );
  });

  it('defensively redirects non-admin users away from admin routes', async () => {
    renderApp('/admin', {
      user: {
        roles: ['user'],
        username: 'member',
      },
    });

    await waitFor(() => expect(currentUrl()).toBe('/volunteering'));
    expect(screen.queryByText('Admin route')).not.toBeInTheDocument();
  });

  it('redirects legacy routes to their replacement', async () => {
    renderApp('/about');

    await waitFor(() => expect(currentUrl()).toBe('/'));
  });

  it('sends guests from the members-only circle to sign in', async () => {
    renderApp('/circles/naturists');

    await waitFor(() =>
      expect(currentUrl()).toBe(
        '/signin?continue=true&returnTo=%2Fcircles%2Fnaturists',
      ),
    );
  });

  it('routes ordinary React-owned links through client navigation', async () => {
    renderApp('/rules');
    await screen.findByText('Rules route');
    const link = document.createElement('a');
    link.href = '/faq?topic=routes';
    link.textContent = 'FAQ';
    document.body.appendChild(link);

    try {
      expect(fireEvent.click(link)).toBe(false);
      await waitFor(() => expect(currentUrl()).toBe('/faq?topic=routes'));
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
    renderApp('/rules');
    await screen.findByText('Rules route');
    const link = document.createElement('a');
    link.href = '/api/auth/signout';
    link.textContent = 'Sign out';
    document.body.appendChild(link);

    try {
      expect(fireEvent.click(link)).toBe(true);
    } finally {
      link.remove();
    }
  });

  it('wraps offer pages in the offer layout', async () => {
    renderApp('/offer/host', { user: { username: 'member', public: false } });

    expect(
      await screen.findByRole('heading', { name: "Don't panic!" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Host travellers - Trustroots'),
    );
  });

  it('loads the circles list in its route loader', async () => {
    vi.mocked(tribesApi.read).mockResolvedValue([
      { _id: 'circle-1', slug: 'walkers', label: 'Walkers', count: 2 },
    ]);
    renderApp('/circles');

    expect(await screen.findByText('Walkers')).toBeInTheDocument();
    expect(tribesApi.read).toHaveBeenCalledTimes(1);
  });

  it('loads a circle in its route loader', async () => {
    vi.mocked(tribesApi.get).mockResolvedValue({
      _id: 'circle-1',
      slug: 'walkers',
      label: 'Walkers',
      count: 2,
    });
    renderApp('/circles/walkers');

    expect(
      await screen.findByRole('heading', { name: 'Walkers' }),
    ).toBeInTheDocument();
    expect(tribesApi.get).toHaveBeenCalledTimes(1);
    expect(tribesApi.get).toHaveBeenCalledWith('walkers');
  });

  it('redirects unmatched paths to the not-found route', async () => {
    renderApp('/missing-react-route');

    await waitFor(() => {
      expect(currentUrl()).toBe('/not-found');
      expect(
        screen.getByText(/this page cannot be found/i),
      ).toBeInTheDocument();
      expect(screen.queryByText('Header guest')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Footer')).toBeInTheDocument();
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
      nextParams: null,
    };
    Reflect.apply(
      mockedMessagesApi.fetchMessages.mockResolvedValue,
      mockedMessagesApi.fetchMessages,
      [messagesResponse],
    );
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

  it('reads the profile again after the member saves profile changes', async () => {
    const profile = {
      _id: 'member-one',
      displayName: 'Member One',
      username: 'member-one',
      description: 'A fictional member description',
      member: [],
    };
    mockedUsersApi.fetch.mockResolvedValue(profile);
    const router = createAppRouter();
    renderApp(
      '/profile/member-one',
      { user: { _id: 'member-one', username: 'member-one', public: true } },
      { router },
    );
    await screen.findByText('A fictional member description');
    await act(() => router.navigate({ to: '/rules' }));
    await screen.findByText('Rules route');

    mockedUsersApi.fetch.mockResolvedValue({
      ...profile,
      description: 'A saved fictional description',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save user changes' }));
    await screen.findByText('Header member-after');
    await act(() =>
      router.navigate({
        to: '/profile/$username',
        params: { username: 'member-one' },
      }),
    );

    expect(
      await screen.findByText('A saved fictional description'),
    ).toBeInTheDocument();
    expect(mockedUsersApi.fetch).toHaveBeenCalledTimes(2);
  });

  it('updates the current page and header immediately when user state changes', async () => {
    renderApp('/support', { user: { username: 'member-before' } });
    await screen.findByText('Support route member-before');
    fireEvent.click(screen.getByRole('button', { name: 'Save user changes' }));
    await screen.findByText('Support route member-after');
    expect(screen.getByText('Header member-after')).toBeInTheDocument();
  });

  it('reruns route guards only when the member identity or roles change', async () => {
    const router = createAppRouter();
    const invalidate = vi.spyOn(router, 'invalidate');
    renderApp(
      '/admin/audit-log',
      { user: { _id: 'staff-1', roles: ['user', 'admin'], username: 'staff' } },
      { router },
    );
    await screen.findByText('Admin audit route');
    fireEvent.click(screen.getByRole('button', { name: 'Save user changes' }));
    await screen.findByText('Header member-after');
    expect(invalidate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Drop admin role' }));
    await waitFor(() => expect(currentUrl()).toBe('/volunteering'));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('shows the not-found page for an invalid circle address', async () => {
    renderApp('/circles/Sample_circle');

    expect(
      await screen.findByText(/this page cannot be found/i),
    ).toBeInTheDocument();
    expect(currentUrl()).toBe('/not-found');
  });
});
