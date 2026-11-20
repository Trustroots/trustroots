import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AuthUser } from '@/modules/core/client/react-app/auth';

import {
  createAppRouter,
  parseLegacySearch,
  stringifyLegacySearch,
} from '@/layers/shell/client/router';
import {
  accessRedirect,
  matchAppRoute,
  type RoutePolicy,
} from '@/layers/shell/client/route-options';
import { AppProviders } from '@/layers/shell/client/AppProviders';

type UserRouteProps = { user?: AuthUser | null };
type MembershipRouteProps = UserRouteProps & {
  onMembershipUpdated: (data: { user?: Partial<AuthUser> } | null) => void;
};
type StatisticsRouteProps = { isAuthenticated: boolean };
type ShellRoute = RoutePolicy & {
  component: React.ComponentType;
  id: string;
  path: string;
};

const router = createAppRouter();
const routes = Object.values(router.routesById).flatMap(route => {
  const policy = route.options.staticData as RoutePolicy | undefined;
  // Profile tabs render through the profile route's component.
  const component =
    route.options.component ?? route.parentRoute?.options.component;
  return policy?.title
    ? [
        {
          ...policy,
          component,
          id: route.id,
          path: route.fullPath
            .replace(/(.)\/$/, '$1')
            .replace(/\$(\w+)/g, ':$1'),
        } as ShellRoute,
      ]
    : [];
});

function findRoute(path: string) {
  const url = new URL(path, 'https://trustroots.test');
  const match = matchAppRoute(router, url.pathname);
  const route = routes.find(({ id }) => id === match?.routeId);
  return route && { ...route, params: match!.params };
}

const returnTo = '/fictional-return';
const signIn = `/signin?continue=true&returnTo=${encodeURIComponent(returnTo)}`;
const access = (path: string, user: { roles?: string[] } | null) =>
  accessRedirect(findRoute(path)!, user, returnTo);

// Routes that are not mocked below fire API requests on mount. Keep them off
// the network: real jsdom XHRs to localhost stay open after the tests finish
// and make the Jest worker fail to exit gracefully.
vi.mock('@/modules/core/client/api/http-client', () => {
  const pending = () => new Promise(() => {});
  return {
    __esModule: true,
    default: {
      get: pending,
      post: pending,
      put: pending,
      patch: pending,
      delete: pending,
    },
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
    getErrorResponse: () => undefined,
    onRequestFailure: () => () => undefined,
  };
});

/* eslint-disable react/display-name -- lightweight route renderer mocks for coverage */
vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);
vi.mock('@/modules/admin/client/components/Admin.component', () => ({
  default: () => <main>Admin</main>,
}));
vi.mock(
  '@/modules/admin/client/components/AdminAcquisitionStories.component',
  () => ({ default: () => <main>Admin acquisition stories</main> }),
);
vi.mock('@/modules/admin/client/components/AdminAuditLog.component', () => ({
  default: () => <main>Admin audit log</main>,
}));
vi.mock(
  '@/modules/admin/client/components/AdminUsernameChanges.component',
  () => ({ default: () => <main>Admin username changes</main> }),
);
vi.mock('@/modules/admin/client/components/AdminCircles.component', () => ({
  default: () => <main>Admin circles</main>,
}));
vi.mock('@/modules/admin/client/components/AdminMessages.component', () => ({
  default: () => <main>Admin messages</main>,
}));
vi.mock(
  '@/modules/admin/client/components/AdminLocationCorrections.component',
  () => ({ default: () => <main>Location corrections</main> }),
);
vi.mock('@/modules/admin/client/components/AdminNewsletter.component', () => ({
  default: () => <main>Admin newsletter</main>,
}));
vi.mock(
  '@/modules/admin/client/components/AdminReferenceThreads.component',
  () => ({ default: () => <main>Admin reference threads</main> }),
);
vi.mock('@/modules/admin/client/components/AdminSearchUsers.component', () => ({
  default: () => <main>Admin search users</main>,
}));
vi.mock('@/modules/admin/client/components/AdminHeader.component', () => ({
  default: () => <nav>Staff navigation</nav>,
}));
vi.mock(
  '@/modules/admin/client/components/NetworkConnections.component',
  () => ({
    NetworkConnectionSearchPage: () => <main>External connection search</main>,
  }),
);
vi.mock('@/modules/admin/client/components/AdminThreads.component', () => ({
  default: () => <main>Admin threads</main>,
}));
vi.mock('@/modules/admin/client/components/AdminUser.component', () => {
  function MockAdminUser({ username }: { username?: string }) {
    return <main data-username={username}>Admin user</main>;
  }
  return { default: MockAdminUser };
});
vi.mock('@/modules/core/client/components/NotFoundPage.component', () => ({
  default: () => <main>Not found</main>,
}));
vi.mock('@/modules/pages/client/components/Home.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => (
    <main>Home {user?.username || 'guest'}</main>
  ),
}));
vi.mock('@/modules/pages/client/components/Navigation.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => (
    <main>Navigation {user?.username}</main>
  ),
}));
vi.mock('@/modules/pages/client/components/Contribute.component', () => ({
  default: () => <main>Contribute</main>,
}));
vi.mock(
  '@/modules/pages/client/components/FaqBugsAndFeatures.component',
  () => ({ default: () => <main>FAQ bugs</main> }),
);
vi.mock('@/modules/pages/client/components/FaqFoundation.component', () => ({
  default: () => <main>FAQ foundation</main>,
}));
vi.mock('@/modules/pages/client/components/FaqGeneral.component', () => ({
  default: () => <main>FAQ general</main>,
}));
vi.mock('@/modules/pages/client/components/FaqTechnology.component', () => ({
  default: () => <main>FAQ technology</main>,
}));
vi.mock('@/modules/pages/client/components/FaqTribes.component', () => ({
  default: () => <main>FAQ tribes</main>,
}));
vi.mock('@/modules/pages/client/components/Foundation.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => (
    <main>Foundation {user?.username}</main>
  ),
}));
vi.mock('@/modules/pages/client/components/Guide.component', () => ({
  default: () => <main>Guide</main>,
}));
vi.mock('@/modules/pages/client/components/Media.component', () => ({
  default: () => <main>Media</main>,
}));
vi.mock('@/modules/pages/client/components/Privacy.component', () => ({
  default: () => <main>Privacy</main>,
}));
vi.mock('@/modules/pages/client/components/Rules.component', () => ({
  default: () => <main>Rules</main>,
}));
vi.mock('@/modules/pages/client/components/Safety.component', () => ({
  default: () => <main>Safety</main>,
}));
vi.mock('@/modules/statistics/client/components/Statistics.component', () => ({
  __esModule: true,
  default: ({ isAuthenticated }: StatisticsRouteProps) => (
    <main>Statistics {isAuthenticated ? 'auth' : 'guest'}</main>
  ),
}));
vi.mock('@/modules/support/client/components/SupportPage.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => <main>Support {user?.username}</main>,
}));
vi.mock('@/modules/pages/client/components/Team.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => <main>Team {user?.username}</main>,
}));
vi.mock('@/modules/pages/client/components/Volunteering.component', () => ({
  default: ({ children }: React.PropsWithChildren) => (
    <main>Volunteering{children}</main>
  ),
}));
vi.mock('@/modules/tribes/client/components/TopicChat', () => ({
  default: ({ roomName, user }: UserRouteProps & { roomName: string }) => (
    <p>
      {roomName} chat for {user?.username ?? 'visitor'}
      {typeof user?.nostrNpub === 'string' && ` with ${user.nostrNpub}`}
    </p>
  ),
}));
vi.mock('@/modules/users/client/components/Welcome.component', () => ({
  default: () => <main>Welcome</main>,
}));
vi.mock('@/modules/messages/client/components/Inbox.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => <main>Inbox {user?.username}</main>,
}));
vi.mock('@/modules/messages/client/components/Thread.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => <main>Thread {user?.username}</main>,
}));
vi.mock('@/modules/search/client/components/SearchUsers.component', () => ({
  default: () => <main>Search members</main>,
}));
vi.mock('@/modules/search/client/components/SearchPage.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => <main>Search {user?.username}</main>,
}));
vi.mock('@/modules/offers/client/components/OfferHostPage.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => (
    <main>Offer host {user?.username}</main>
  ),
}));
vi.mock(
  '@/modules/offers/client/components/OfferMeetListPage.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Offer meet list {user?.username}</main>
    ),
  }),
);
vi.mock(
  '@/modules/offers/client/components/OfferMeetEditPage.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Offer meet edit {user?.username}</main>
    ),
  }),
);
vi.mock('@/modules/users/client/components/SigninPage.component', () => ({
  default: () => <main>Sign in</main>,
}));
vi.mock('@/modules/users/client/components/SignupPage.component', () => ({
  default: () => <main>Sign up</main>,
}));
vi.mock('@/modules/users/client/components/ConfirmEmailPage.component', () => ({
  default: () => <main>Confirm email</main>,
}));
vi.mock(
  '@/modules/users/client/components/ConfirmEmailInvalidPage.component',
  () => ({ default: () => <main>Confirm email invalid</main> }),
);
vi.mock(
  '@/modules/users/client/components/ForgotPasswordPage.component',
  () => ({ default: () => <main>Forgot password</main> }),
);
vi.mock(
  '@/modules/users/client/components/ResetPasswordPage.component',
  () => ({ default: () => <main>Reset password</main> }),
);
vi.mock(
  '@/modules/users/client/components/ResetPasswordSuccessPage.component',
  () => ({ default: () => <main>Reset password success</main> }),
);
vi.mock(
  '@/modules/users/client/components/ResetPasswordInvalidPage.component',
  () => ({ default: () => <main>Reset password invalid</main> }),
);
vi.mock(
  '@/modules/users/client/components/RemoveProfilePage.component',
  () => ({ default: () => <main>Remove profile</main> }),
);
vi.mock(
  '@/modules/users/client/components/ProfileSignupPage.component',
  () => ({ default: () => <main>Profile signup</main> }),
);
vi.mock('@/modules/users/client/components/ProfilePage.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => <main>Profile {user?.username}</main>,
}));
vi.mock('@/modules/users/client/components/ProfileEditAbout.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => (
    <main>Profile edit about {user?.username}</main>
  ),
}));
vi.mock(
  '@/modules/users/client/components/ProfileEditLocations.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Profile edit locations {user?.username}</main>
    ),
  }),
);
vi.mock('@/modules/users/client/components/ProfileEditPhoto.component', () => ({
  __esModule: true,
  default: ({ user }: UserRouteProps) => (
    <main>Profile edit photo {user?.username}</main>
  ),
}));
vi.mock(
  '@/modules/users/client/components/ProfileEditNetworks.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Profile edit networks {user?.username}</main>
    ),
  }),
);
vi.mock(
  '@/modules/users/client/components/ProfileEditAccount.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Profile edit account {user?.username}</main>
    ),
  }),
);
vi.mock(
  '@/modules/contacts/client/components/ContactAddPage.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Contact add {user?.username}</main>
    ),
  }),
);
vi.mock(
  '@/modules/contacts/client/components/ContactConfirmPage.component',
  () => ({
    __esModule: true,
    default: ({ user }: UserRouteProps) => (
      <main>Contact confirm {user?.username}</main>
    ),
  }),
);
vi.mock('@/modules/tribes/client/components/TribesPage.component', () => ({
  __esModule: true,
  default: ({ onMembershipUpdated, user }: MembershipRouteProps) => (
    <main>
      Circles {user?.username || 'guest'}
      <button
        type="button"
        onClick={() => onMembershipUpdated({ user: { username: 'updated' } })}
      >
        Update circle membership
      </button>
    </main>
  ),
}));
vi.mock('@/modules/tribes/client/components/TribeDetailPage.component', () => ({
  __esModule: true,
  default: ({ onMembershipUpdated, user }: MembershipRouteProps) => (
    <main>
      Circle detail {user?.username || 'guest'}
      <button
        type="button"
        onClick={() => onMembershipUpdated({ user: { username: 'updated' } })}
      >
        Update detail membership
      </button>
    </main>
  ),
}));
/* eslint-enable react/display-name */

function renderRoute(
  route: ShellRoute | undefined,
  user: AuthUser | null = { username: 'alice', public: true },
) {
  if (!route) {
    throw new Error('Expected a matching route');
  }
  const params: Record<string, string> =
    route.path === '/admin/user/:username'
      ? { username: 'river' }
      : route.path === '/messages/:username'
        ? { username: 'bob' }
        : route.path === '/circles/:circle'
          ? { circle: 'hitchhikers' }
          : route.path === '/confirm-email/:token'
            ? { token: 'confirm-token' }
            : route.path === '/password/reset/:token'
              ? { token: 'reset-token' }
              : route.path === '/remove/:token'
                ? { token: 'remove-token' }
                : route.path === '/offer/meet/:offerId'
                  ? { offerId: '665100000000000000000001' }
                  : route.path.startsWith('/profile/:username')
                    ? { username: 'alice' }
                    : route.path === '/contact-add/:userId'
                      ? { userId: 'user-2' }
                      : route.path === '/contact-confirm/:contactId'
                        ? { contactId: 'contact-1' }
                        : {};
  window.history.pushState(
    {},
    '',
    route.path.replace(/:([^/]+)/g, (_, key: string) => params[key] || ''),
  );

  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: { profileMinimumLength: 140 },
        title: 'Trustroots',
        user,
      }}
    >
      <route.component />
    </AppProviders>,
  );
}

describe('React route ownership', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('renders the staff network connection search page', () => {
    renderRoute(
      routes.find(route => route.path === '/admin/network-connections'),
      { roles: ['support-team'] },
    );
    expect(screen.getByText('Staff navigation')).toBeInTheDocument();
    expect(screen.getByText('External connection search')).toBeInTheDocument();
  });

  it('passes username deep links to the administrator member lookup', () => {
    renderRoute(
      routes.find(route => route.path === '/admin/user/:username'),
      { roles: ['admin'] },
    );
    expect(screen.getByText('Admin user')).toHaveAttribute(
      'data-username',
      'river',
    );
  });
  it('shows suspended members the suspended page without the site chrome', () => {
    const route = findRoute('/suspended')!;
    expect(route).toMatchObject({ footerHidden: true, headerHidden: true });
    expect(access('/suspended', null)).toBeUndefined();

    renderRoute(route, null);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your account has been suspended.',
    );
  });

  it('defines a renderer for every React-owned route policy', () => {
    routes.forEach(route => {
      expect(route.component).toEqual(expect.any(Function));
    });
  });

  it('ignores trailing slashes and queries when matching routes', () => {
    expect(findRoute('/support/?report=alice')?.title).toBe('Support');
  });

  it('preserves legacy plain-string query parameters', () => {
    expect(parseLegacySearch('?userId=123&filter=unread')).toEqual({
      filter: 'unread',
      userId: '123',
    });
    expect(
      stringifyLegacySearch({
        empty: '',
        filter: 'unread',
        missing: undefined,
        userId: '123',
      }),
    ).toBe('?empty=&filter=unread&userId=123');

    const router = createAppRouter();
    expect(router.options.parseSearch('?userId=123')).toEqual({
      userId: '123',
    });
    expect(router.options.stringifySearch({ userId: '123' })).toBe(
      '?userId=123',
    );
  });

  it('matches parametrised routes and exposes params', () => {
    expect(findRoute('/messages/alice')).toMatchObject({
      params: { username: 'alice' },
      path: '/messages/:username',
    });
    expect(findRoute('/circles/hitchhikers')).toMatchObject({
      params: { circle: 'hitchhikers' },
      path: '/circles/:circle',
    });
  });

  it('keeps the same profile route mounted across profile tabs', () => {
    const router = createAppRouter();
    const profileMatches = router.matchRoutes('/profile/alice');
    for (const suffix of [
      'about',
      'accommodation',
      'contacts',
      'experiences',
      'experiences/new',
      'overview',
      'tribes',
    ]) {
      const matches = router.matchRoutes(`/profile/alice/${suffix}`);
      expect(matches[matches.length - 2].routeId).toBe(
        profileMatches[profileMatches.length - 1].routeId,
      );
    }
  });

  it('defines the admin home policy', () => {
    expect(findRoute('/admin/')).toMatchObject({
      footerVariant: 'admin',
      path: '/admin',
      requiresRole: ['admin', 'support-team'],
      title: 'Admin',
    });
  });

  it('defines admin route metadata and renderers', () => {
    const adminRoute = findRoute('/admin/audit-log')!;

    expect(adminRoute).toMatchObject({
      footerVariant: 'admin',
      path: '/admin/audit-log',
      requiresRole: ['admin'],
      title: 'Admin - Audit log',
    });
    expect(adminRoute.component).toEqual(expect.any(Function));

    expect(findRoute('/admin/gravatar')).toMatchObject({
      path: '/admin/gravatar',
      requiresRole: ['admin'],
    });
    expect(findRoute('/admin/support/flagged')).toMatchObject({
      path: '/admin/support/flagged',
      requiresRole: ['admin', 'support-team'],
    });
    const usernameChangesRoute = findRoute('/admin/username-changes')!;
    expect(usernameChangesRoute).toMatchObject({
      footerVariant: 'admin',
      path: '/admin/username-changes',
      requiresRole: ['admin'],
      title: 'Admin - Username changes',
    });
    expect(
      renderRoute(usernameChangesRoute).getByText('Admin username changes'),
    ).toBeInTheDocument();

    expect(
      findRoute('/admin/support/requests/111111111111111111111111'),
    ).toMatchObject({
      params: { requestId: '111111111111111111111111' },
      path: '/admin/support/requests/:requestId',
      requiresRole: ['admin', 'support-team'],
    });

    expect(findRoute('/admin/support/members')).toMatchObject({
      path: '/admin/support/members',
      requiresRole: ['admin', 'support-team'],
      title: 'Support - Member search',
    });
  });

  it('renders the admin circles route with admin metadata', () => {
    const route = findRoute('/admin/circles')!;
    expect(route).toMatchObject({
      path: '/admin/circles',
      requiresRole: ['admin'],
      title: 'Admin - Circles',
    });
    expect(renderRoute(route).getByText('Admin circles')).toBeInTheDocument();
  });

  it('registers and renders the administrator MongoDB diagnostics route', () => {
    const route = findRoute('/admin/mongo')!;
    expect(route).toMatchObject({
      path: '/admin/mongo',
      requiresRole: ['admin'],
      title: 'Admin - MongoDB diagnostics',
    });
    expect(
      renderRoute(route).getByRole('heading', { name: 'MongoDB diagnostics' }),
    ).toBeInTheDocument();
  });

  it('protects and renders the selected circle editor route', () => {
    const route = findRoute('/admin/circles/walkers')!;
    expect(route).toMatchObject({
      path: '/admin/circles/:circle',
      requiresRole: ['admin'],
    });
    expect(renderRoute(route).getByText('Admin circles')).toBeInTheDocument();
  });

  it.each([
    [null, 'volunteering chat for visitor'],
    [
      { _id: 'fictional-volunteer', username: 'river' },
      'volunteering chat for river',
    ],
    [
      {
        _id: 'fictional-volunteer',
        username: 'river',
        nostrNpub: 'linked-key',
      },
      'volunteering chat for river with linked-key',
    ],
  ])(
    'passes the available member identity to volunteering chat',
    (user, text) => {
      expect(
        renderRoute(findRoute('/volunteering'), user).getByText(text),
      ).toBeInTheDocument();
    },
  );

  it('returns access redirects for protected route policies', () => {
    expect(access('/admin', null)).toBe(signIn);
    expect(access('/about', null)).toBe('/');
    expect(access('/offer', { roles: ['user'] })).toBe('/offer/host');
    expect(access('/admin', { roles: ['user'] })).toBe('/volunteering');
    expect(access('/admin', { roles: ['user', 'admin'] })).toBeUndefined();
    expect(access('/admin', { roles: ['support-team'] })).toBeUndefined();
    expect(access('/support', null)).toBeUndefined();
    expect(access('/messages', null)).toBe(signIn);
    expect(access('/messages', {})).toBeUndefined();
  });

  it.each([
    ['/admin/experience-changes', ['admin', 'support-team']],
    ['/admin/user/fictional-member', ['admin', 'support-team']],
    ['/admin/user', ['admin']],
    ['/admin/acquisition-stories', ['admin', 'welcome-team', 'support-team']],
    ['/admin/staff-blockers', ['admin', 'welcome-team', 'support-team']],
    ['/admin/location-corrections', ['admin', 'welcome-team']],
    ['/admin/gravatar', ['admin']],
  ])('lets only the right staff roles open %s', (path, allowed) => {
    for (const role of ['admin', 'support-team', 'welcome-team', 'user']) {
      expect(access(path, { roles: [role] })).toBe(
        allowed.includes(role) ? undefined : '/volunteering',
      );
    }
    expect(access(path, null)).toBe(signIn);
  });

  it.each(['/welcome', '/navigation', '/search/members'])(
    'keeps the member entry route %s authenticated and footer-free',
    path => {
      expect(findRoute(path)?.footerHidden).toBe(true);
      expect(access(path, null)).toBe(signIn);
      expect(access(path, { roles: ['user'] })).toBeUndefined();
    },
  );

  it('matches profile and contact route policies', () => {
    expect(findRoute('/profile/alice')).toMatchObject({
      params: { username: 'alice' },
      path: '/profile/:username',
      requiresAuth: true,
      noScrollingTop: true,
    });
    expect(findRoute('/profile/alice/experiences/new')).toMatchObject({
      params: { username: 'alice' },
      path: '/profile/:username/experiences/new',
    });
    expect(findRoute('/profile/edit')).toMatchObject({
      path: '/profile/edit',
      requiresAuth: true,
    });
    expect(findRoute('/contact-add/user-2')).toMatchObject({
      params: { userId: 'user-2' },
      path: '/contact-add/:userId',
      requiresAuth: true,
    });
    expect(access('/profile/alice', null)).toBe(signIn);
  });

  it('does not claim legacy profile-edit paths', () => {
    expect(findRoute('/profile-edit/about')).toBe(undefined);
  });

  it('renders every React-owned route that does not redirect', () => {
    routes
      .filter(route => !route.redirectTo)
      .forEach(route => {
        const { container, unmount } = renderRoute(route);

        expect(container.firstChild).toBeTruthy();
        unmount();
      });
  });

  it('renders no message thread when the route has no authenticated user', () => {
    const { container } = renderRoute(findRoute('/messages/bob'), null);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders circle list and detail routes for guests and members', () => {
    const circlesRoute = findRoute('/circles');
    const detailRoute = findRoute('/circles/hitchhikers');

    expect(renderRoute(circlesRoute, null).container).toHaveTextContent(
      'Circles guest',
    );
    expect(renderRoute(detailRoute, null).container).toHaveTextContent(
      'Circle detail guest',
    );
    expect(
      renderRoute(detailRoute, { username: 'alice', public: true }).container,
    ).toHaveTextContent('Circle detail alice');
  });

  it('forwards circle membership updates through route callbacks', () => {
    const circles = renderRoute(findRoute('/circles'));
    fireEvent.click(
      circles.getByRole('button', { name: 'Update circle membership' }),
    );

    const detail = renderRoute(findRoute('/circles/hitchhikers'));
    fireEvent.click(
      detail.getByRole('button', { name: 'Update detail membership' }),
    );
  });
});

it('does not partially match extra circle path segments', () => {
  expect(findRoute('/circles/sample/extra')).toBeUndefined();
});
