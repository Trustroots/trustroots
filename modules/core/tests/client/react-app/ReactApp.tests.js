import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { routes } from '@/modules/core/client/react-app/routes';

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
    return <main>Support route {user?.username}</main>;
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
        <button type="button" onClick={() => onSignout()}>
          Sign out without event
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

describe('<ReactApp />', () => {
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    window.scrollTo = jest.fn();
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
      </AppProviders>,
    );
  }

  it('renders a React-owned route and updates the document title', () => {
    renderApp('/rules');

    expect(screen.getByText('Rules route')).toBeInTheDocument();
    expect(screen.getByText('Header guest')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(document.title).toBe('Rules - Trustroots');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('passes bootstrap user data to route and shell components', () => {
    renderApp('/support?report=alice', {
      user: {
        username: 'bob',
      },
    });

    expect(screen.getByText('Support route bob')).toBeInTheDocument();
    expect(screen.getByText('Header bob')).toBeInTheDocument();
  });

  it('renders admin routes for admin users and shows the admin footer', () => {
    renderApp('/admin/audit-log', {
      user: {
        roles: ['user', 'admin'],
        username: 'admin',
      },
    });

    expect(screen.getByText('Admin audit route')).toBeInTheDocument();
    expect(screen.getByText('Header admin')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(document.title).toBe('Admin - Audit log - Trustroots');
  });

  it('honors headerHidden and noScrollingTop route metadata', () => {
    const route = routes.find(route => route.path === '/rules');
    route.headerHidden = true;
    route.noScrollingTop = true;

    try {
      renderApp('/rules');

      expect(screen.getByText('Rules route')).toBeInTheDocument();
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

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/signin'));
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

  it('renders not found content for unmatched React paths', () => {
    renderApp('/missing-react-route');

    expect(screen.getByText(/this page cannot be found/i)).toBeInTheDocument();
    expect(screen.getByText('Header guest')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('handles browser navigation and sign out actions', async () => {
    const postMessage = jest.fn();
    const originalPostMessage = window.postMessage;
    const originalTop = window.top;
    let topHref = 'http://localhost/rules';

    window.postMessage = postMessage;
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {
        location: {
          get href() {
            return topHref;
          },
          set href(value) {
            topHref = value;
          },
        },
      },
    });

    try {
      renderApp('/rules');

      window.history.pushState({}, '', '/faq');
      window.dispatchEvent(new PopStateEvent('popstate'));

      await waitFor(() =>
        expect(document.title).toBe('FAQ - Site & community - Trustroots'),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

      expect(postMessage).toHaveBeenCalledWith(
        'unAuthenticated',
        `${window.location.protocol}//${window.location.host}`,
      );
      expect(topHref).toBe('/api/auth/signout');
    } finally {
      window.postMessage = originalPostMessage;
      Object.defineProperty(window, 'top', {
        configurable: true,
        value: originalTop,
      });
      window.history.pushState({}, '', '/');
    }
  });

  it('posts native mobile sign out messages via the header action', () => {
    const postMessage = jest.fn();
    const originalPostMessage = window.postMessage;
    const originalTop = window.top;
    const originalIsNativeMobileApp = window.isNativeMobileApp;
    let topHref = 'http://localhost/rules';

    window.postMessage = postMessage;
    window.isNativeMobileApp = true;
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {
        location: {
          get href() {
            return topHref;
          },
          set href(value) {
            topHref = value;
          },
        },
      },
    });

    try {
      renderApp('/rules');
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

      expect(postMessage).toHaveBeenCalledWith(
        JSON.stringify({ action: 'unAuthenticated' }),
      );
      expect(topHref).toBe('/api/auth/signout');
    } finally {
      window.postMessage = originalPostMessage;
      window.isNativeMobileApp = originalIsNativeMobileApp;
      Object.defineProperty(window, 'top', {
        configurable: true,
        value: originalTop,
      });
    }
  });
});
