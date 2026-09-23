import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import {
  findRoute,
  isReactRoute,
  routes,
} from '@/modules/core/client/react-app/routes';
import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  REACT_OWNED_PATHS,
  REACT_ROUTE_POLICIES,
  normalizePath,
} from '@/modules/core/shared/react-route-ownership';

/* eslint-disable react/display-name -- lightweight route renderer mocks for coverage */
jest.mock('@/modules/tribes/client/components/CirclesRoute', () => () => (
  <main>Circle route</main>
));
jest.mock('@/modules/users/client/components/ProfilePage.component', () => ({
  __esModule: true,
  default: ({ username }) => <main>Profile route {username}</main>,
}));
jest.mock('@/modules/pages/client/components/Navigation.component', () => ({
  __esModule: true,
  default: ({ user, onSignout }) => (
    <main>
      <p>{user.username}</p>
      <a href="/api/auth/signout" onClick={onSignout}>
        Sign out
      </a>
    </main>
  ),
}));
jest.mock('@/modules/users/client/components/Welcome.component', () => () => (
  <main>Welcome</main>
));
jest.mock(
  '@/modules/search/client/components/SearchUsers.component',
  () => () => <main>Search members</main>,
);
jest.mock('@/modules/admin/client/components/Admin.component', () => () => (
  <main>Admin</main>
));
jest.mock(
  '@/modules/admin/client/components/AdminAcquisitionStories.component',
  () => () => <main>Admin acquisition stories</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminAcquisitionStoriesAnalysis.component',
  () => () => <main>Admin acquisition stories analysis</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminAuditLog.component',
  () => () => <main>Admin audit log</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminMessages.component',
  () => () => <main>Admin messages</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminNewsletter.component',
  () => () => <main>Admin newsletter</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminReferenceThreads.component',
  () => () => <main>Admin reference threads</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminSearchUsers.component',
  () => () => <main>Admin search users</main>,
);
jest.mock(
  '@/modules/admin/client/components/AdminThreads.component',
  () => () => <main>Admin threads</main>,
);
jest.mock('@/modules/admin/client/components/AdminUser.component', () => () => (
  <main>Admin user</main>
));
jest.mock(
  '@/modules/core/client/components/NotFoundPage.component',
  () => () => <main>Not found</main>,
);
jest.mock(
  '@/modules/pages/client/components/Contribute.component',
  () => () => <main>Contribute</main>,
);
jest.mock(
  '@/modules/pages/client/components/FaqBugsAndFeatures.component',
  () => () => <main>FAQ bugs</main>,
);
jest.mock(
  '@/modules/pages/client/components/FaqFoundation.component',
  () => () => <main>FAQ foundation</main>,
);
jest.mock(
  '@/modules/pages/client/components/FaqGeneral.component',
  () => () => <main>FAQ general</main>,
);
jest.mock(
  '@/modules/pages/client/components/FaqTechnology.component',
  () => () => <main>FAQ technology</main>,
);
jest.mock('@/modules/pages/client/components/FaqTribes.component', () => () => (
  <main>FAQ tribes</main>
));
jest.mock('@/modules/pages/client/components/Foundation.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Foundation {user?.username}</main>,
}));
jest.mock('@/modules/pages/client/components/Guide.component', () => () => (
  <main>Guide</main>
));
jest.mock('@/modules/pages/client/components/Media.component', () => () => (
  <main>Media</main>
));
jest.mock('@/modules/pages/client/components/Privacy.component', () => () => (
  <main>Privacy</main>
));
jest.mock('@/modules/pages/client/components/Rules.component', () => () => (
  <main>Rules</main>
));
jest.mock(
  '@/modules/statistics/client/components/Statistics.component',
  () => ({
    __esModule: true,
    default: ({ isAuthenticated }) => (
      <main>Statistics {isAuthenticated ? 'auth' : 'guest'}</main>
    ),
  }),
);
jest.mock('@/modules/support/client/components/SupportPage.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Support {user?.username}</main>,
}));
jest.mock('@/modules/pages/client/components/Team.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Team {user?.username}</main>,
}));
jest.mock(
  '@/modules/pages/client/components/Volunteering.component',
  () => () => <main>Volunteering</main>,
);

jest.mock(
  '@/modules/users/client/components/ForgotPasswordPage.component',
  () => () => <main>ForgotPasswordPage</main>,
);
jest.mock(
  '@/modules/users/client/components/ResetPasswordSuccessPage.component',
  () => () => <main>ResetPasswordSuccessPage</main>,
);
jest.mock(
  '@/modules/users/client/components/ResetPasswordInvalidPage.component',
  () => () => <main>ResetPasswordInvalidPage</main>,
);
jest.mock(
  '@/modules/users/client/components/ConfirmEmailInvalidPage.component',
  () => () => <main>ConfirmEmailInvalidPage</main>,
);
jest.mock(
  '@/modules/contacts/client/components/ContactConfirmPage.component',
  () => () => <main>ContactConfirmPage</main>,
);
jest.mock('@/modules/pages/client/components/HomeRoute', () => () => (
  <main>HomeRoute</main>
));
jest.mock('@/modules/pages/client/components/Safety.component', () => () => (
  <main>Safety</main>
));

/* eslint-enable react/display-name */

describe('React route ownership', () => {
  it('keeps the React route table aligned with the shared ownership list', () => {
    expect(routes.map(route => route.path).sort()).toEqual(
      [...REACT_OWNED_PATHS].sort(),
    );
  });

  it('defines a renderer for every React-owned route policy', () => {
    routes.forEach(route => {
      if (route.redirectTo) {
        expect(route.render).toBeUndefined();
      } else {
        expect(route.render).toEqual(expect.any(Function));
      }
    });
  });

  it('normalizes paths before ownership checks', () => {
    expect(normalizePath('/support/?report=alice')).toBe('/support');
    expect(isReactRoute('/support/?report=alice')).toBe(true);
    expect(findRoute('/support/?report=alice').title).toBe('Support');
  });

  it('keeps the shared route policy aligned with owned paths', () => {
    expect(REACT_ROUTE_POLICIES.map(route => route.path).sort()).toEqual(
      [...REACT_OWNED_PATHS].sort(),
    );
    expect(getReactRoutePolicy('/admin/')).toMatchObject({
      footerVariant: 'admin',
      path: '/admin',
      requiresAuth: true,
      requiresRole: 'admin',
      title: 'Admin',
    });
  });

  it('defines admin route metadata and renderers', () => {
    const adminRoute = findRoute('/admin/audit-log');

    expect(adminRoute).toMatchObject({
      footerVariant: 'admin',
      path: '/admin/audit-log',
      requiresAuth: true,
      requiresRole: 'admin',
      title: 'Admin - Audit log',
    });
    expect(adminRoute.render).toEqual(expect.any(Function));
  });

  it('returns access redirects for protected route policies', () => {
    const route = getReactRoutePolicy('/admin');

    expect(getReactRouteAccessRedirect(route, null)).toBe('/signin');
    expect(getReactRouteAccessRedirect(route, { roles: ['user'] })).toBe(
      '/volunteering',
    );
    expect(
      getReactRouteAccessRedirect(route, { roles: ['user', 'admin'] }),
    ).toBe(null);
    expect(
      getReactRouteAccessRedirect(getReactRoutePolicy('/support'), null),
    ).toBe(null);
  });

  it('does not claim Angular-owned paths', () => {
    expect(isReactRoute('/profile/edit')).toBe(false);
    expect(isReactRoute('/profile/alice/experiences/new')).toBe(false);
    expect(findRoute('/profile/edit')).toBe(undefined);
  });

  it('routes profile views without claiming editors or experience writing', () => {
    const profile = findRoute('/profile/alice/contacts?from=search');
    expect(profile).toMatchObject({
      path: '/profile/:username/contacts',
      params: { username: 'alice' },
      requiresAuth: true,
      noScrollingTop: true,
    });
    expect(getReactRouteAccessRedirect(profile, null)).toBe('/signin');
    expect(getReactRouteAccessRedirect(profile, { username: 'bob' })).toBe(
      null,
    );
    expect(
      render(
        profile.render({ user: { username: 'bob' }, params: profile.params }),
      ).container,
    ).toHaveTextContent(/Profile route alice/);
    for (const path of [
      '/profile/alice',
      '/profile/alice/about',
      '/profile/alice/overview',
      '/profile/alice/accommodation',
      '/profile/alice/tribes',
      '/profile/alice/experiences',
    ]) {
      expect(isReactRoute(path)).toBe(true);
    }
    for (const path of ['/profile/%ZZ', '/profile/%2F', '/profile/:username']) {
      expect(findRoute(path).path).toBe('/not-found');
    }
  });

  it('resolves circle slugs and their access rules', () => {
    expect(findRoute('/circles/hitchhikers')).toMatchObject({
      path: '/circles/:circle',
      params: { circle: 'hitchhikers' },
      requiresAuth: false,
    });
    expect(findRoute('/circles/naturists').requiresAuth).toBe(true);
  });

  it.each([
    '/circles/Hitchhikers',
    '/circles/sample_circle',
    '/circles/:circle',
  ])('renders the not-found page for %s without returning to Angular', path => {
    expect(isReactRoute(path)).toBe(true);
    expect(findRoute(path).path).toBe('/not-found');
  });

  it('renders every React-owned route', () => {
    const user = { username: 'alice' };

    routes.forEach(route => {
      if (route.redirectTo) {
        expect(route.redirectTo).toBe('/');
        return;
      }

      const { container, unmount } = render(
        route.render({ user, params: { circle: 'sample-circle' } }),
      );

      expect(container.firstChild).toBeTruthy();
      unmount();
    });
  });
});
