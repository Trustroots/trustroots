import React from 'react';
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
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as messagesApi from '@/modules/messages/client/api/messages.api';
import * as offersApi from '@/modules/offers/client/api/offers.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { REACT_ROUTE_POLICIES } from '@/modules/core/shared/react-route-ownership';

jest.mock('@/modules/admin/client/components/Admin.component', () => {
  const React = require('react');

  function MockAdmin() {
    return <main>Admin route</main>;
  }

  return MockAdmin;
});

jest.mock('@/modules/admin/client/components/AdminAuditLog.component', () => {
  const React = require('react');

  function MockAdminAuditLog() {
    return <main>Admin audit route</main>;
  }

  return MockAdminAuditLog;
});

jest.mock(
  '@/modules/admin/client/components/AdminAcquisitionStories.component',
  () => {
    const React = require('react');

    function MockAdminAcquisitionStories() {
      return <main>Admin acquisition stories route</main>;
    }

    return MockAdminAcquisitionStories;
  },
);

jest.mock(
  '@/modules/admin/client/components/AdminAcquisitionStoriesAnalysis.component',
  () => {
    const React = require('react');

    function MockAdminAcquisitionStoriesAnalysis() {
      return <main>Admin acquisition stories analysis route</main>;
    }

    return MockAdminAcquisitionStoriesAnalysis;
  },
);

jest.mock('@/modules/admin/client/components/AdminMessages.component', () => {
  const React = require('react');

  function MockAdminMessages() {
    return <main>Admin messages route</main>;
  }

  return MockAdminMessages;
});

jest.mock('@/modules/admin/client/components/AdminNewsletter.component', () => {
  const React = require('react');

  function MockAdminNewsletter() {
    return <main>Admin newsletter route</main>;
  }

  return MockAdminNewsletter;
});

jest.mock(
  '@/modules/admin/client/components/AdminReferenceThreads.component',
  () => {
    const React = require('react');

    function MockAdminReferenceThreads() {
      return <main>Admin reference threads route</main>;
    }

    return MockAdminReferenceThreads;
  },
);

jest.mock(
  '@/modules/admin/client/components/AdminSearchUsers.component',
  () => {
    const React = require('react');

    function MockAdminSearchUsers() {
      return <main>Admin search users route</main>;
    }

    return MockAdminSearchUsers;
  },
);

jest.mock('@/modules/admin/client/components/AdminThreads.component', () => {
  const React = require('react');

  function MockAdminThreads() {
    return <main>Admin threads route</main>;
  }

  return MockAdminThreads;
});

jest.mock('@/modules/admin/client/components/AdminUser.component', () => {
  const React = require('react');

  function MockAdminUser() {
    return <main>Admin user route</main>;
  }

  return MockAdminUser;
});

jest.mock('@/modules/pages/client/components/Rules.component', () => {
  const React = require('react');

  function MockRules() {
    return <main>Rules route</main>;
  }

  return MockRules;
});

jest.mock('@/modules/support/client/components/SupportPage.component', () => {
  const React = require('react');

  function MockSupportPage({ user }) {
    return (
      <main>
        <span>Support route {user?.username}</span>
        <span>Query {global.location.search}</span>
      </main>
    );
  }

  MockSupportPage.propTypes = {
    user: () => null,
  };

  return MockSupportPage;
});

jest.mock('@/modules/core/client/components/AppHeader.component', () => {
  const React = require('react');

  function MockAppHeader({ user, onSignout }) {
    return (
      <header>
        Header {user?.username || 'guest'}
        <button type="button" onClick={onSignout}>
          Sign out
        </button>
      </header>
    );
  }

  MockAppHeader.propTypes = {
    onSignout: () => null,
    user: () => null,
  };

  return MockAppHeader;
});

jest.mock('@/modules/core/client/react-app/ReactFooter', () => {
  const React = require('react');

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
    ({ onSend }) =>
      (
        <button type="button" onClick={() => onSend('A fictional message')}>
          Send message
        </button>
      ),
);
jest.mock(
  '@/modules/messages/client/components/ThreadMessages',
  () =>
    ({ otherUser }) =>
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
    ({ profile }) =>
      <p>{profile.description}</p>,
);
jest.mock(
  '@/modules/search/client/components/SearchPlaceInput.component',
  () => () => null,
);
jest.mock(
  '@/modules/search/client/components/SearchSidebar.component',
  () =>
    ({ offer, onCloseSidebar }) =>
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
const mockOffer = { _id: '665100000000000000000001', location: [10, 20] };
jest.mock('@/modules/search/client/components/SearchMap.component', () => {
  const React = require('react');
  return ({ onOfferOpen, location }) => {
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

  function renderApp(path, bootstrapData = {}, props = {}) {
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
    const route = REACT_ROUTE_POLICIES.find(route => route.path === '/rules');
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
    const user = {
      _id: 'sender',
      username: 'sender',
      public: true,
      description: 'Fictional profile',
    };
    usersApi.fetch.mockImplementation(async username => ({
      _id: `${username}-id`,
      username,
    }));
    messagesApi.fetchMessages.mockResolvedValue({
      messages: [
        {
          _id: 'message-one',
          created: '2026-01-01',
          read: true,
          userFrom: user,
        },
      ],
      nextParams: null,
    });
    messagesApi.sendMessage.mockResolvedValue({});
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
        expect(messagesApi.sendMessage).toHaveBeenCalledWith(
          'member-two-id',
          'A fictional message',
        ),
      );
    } finally {
      link.remove();
    }
  });

  it('keeps the map mounted and its zoom unchanged when opening and closing a pin', async () => {
    offersApi.getOffer.mockResolvedValue(mockOffer);
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
    expect(offersApi.getOffer).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close search sidebar' }),
    );
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(mockMapMount).toHaveBeenCalledTimes(1);
  });

  it('loads an offer from client navigation without recreating the map', async () => {
    offersApi.getOffer.mockResolvedValue(mockOffer);
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
    expect(offersApi.getOffer).not.toHaveBeenCalled();
    expect(mockMapMount).toHaveBeenCalledTimes(1);
  });

  it('allows opening About from mobile profile Overview', async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 390;
    usersApi.fetch.mockResolvedValue({
      _id: 'member-one',
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

  it('updates the current page and header immediately when user state changes', async () => {
    renderApp('/support', { user: { username: 'member-before' } });
    await screen.findByText('Support route member-before');
    fireEvent.click(screen.getByRole('button', { name: 'Save user changes' }));
    await screen.findByText('Support route member-after');
    expect(screen.getByText('Header member-after')).toBeInTheDocument();
  });
});
