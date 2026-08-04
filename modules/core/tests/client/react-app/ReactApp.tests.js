import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
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
});
