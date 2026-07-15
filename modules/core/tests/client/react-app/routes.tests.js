import React from 'react';
import { render } from '@testing-library/react';

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
/* eslint-enable react/display-name */

describe('React route ownership', () => {
  it('keeps the React route table aligned with the shared ownership list', () => {
    expect(routes.map(route => route.path).sort()).toEqual(
      [...REACT_OWNED_PATHS].sort(),
    );
  });

  it('defines a renderer for every React-owned route policy', () => {
    routes.forEach(route => {
      expect(route.render).toEqual(expect.any(Function));
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
    expect(isReactRoute('/profile/alice')).toBe(false);
    expect(findRoute('/profile/alice')).toBe(undefined);
  });

  it('renders every React-owned route', () => {
    const user = { username: 'alice' };

    routes.forEach(route => {
      const { container, unmount } = render(route.render({ user }));

      expect(container.firstChild).toBeTruthy();
      unmount();
    });
  });
});
