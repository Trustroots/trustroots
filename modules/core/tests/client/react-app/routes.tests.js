import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import {
  findRoute,
  isReactRoute,
  routes,
} from '@/modules/core/client/react-app/routes';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  matchReactRoute,
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
  '@/modules/core/client/components/NotFoundPage.component',
  () => () => <main>Not found</main>,
);
jest.mock('@/modules/pages/client/components/Home.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Home {user?.username || 'guest'}</main>,
}));
jest.mock('@/modules/pages/client/components/Navigation.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Navigation {user?.username}</main>,
}));
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
jest.mock('@/modules/users/client/components/Welcome.component', () => () => (
  <main>Welcome</main>
));
jest.mock('@/modules/messages/client/components/Inbox.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Inbox {user?.username}</main>,
}));
jest.mock('@/modules/messages/client/components/Thread.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Thread {user?.username}</main>,
}));
jest.mock(
  '@/modules/search/client/components/SearchUsers.component',
  () => () => <main>Search members</main>,
);
jest.mock('@/modules/search/client/components/SearchPage.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Search {user?.username}</main>,
}));
jest.mock('@/modules/offers/client/components/OfferShell.component', () => ({
  __esModule: true,
  default: ({ children, user }) => (
    <main>
      Offer shell {user?.username}
      {children}
    </main>
  ),
}));
jest.mock(
  '@/modules/offers/client/components/OfferRedirectPage.component',
  () => () => <main>Offer redirect</main>,
);
jest.mock('@/modules/offers/client/components/OfferHostPage.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Offer host {user?.username}</main>,
}));
jest.mock(
  '@/modules/offers/client/components/OfferMeetListPage.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Offer meet list {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/offers/client/components/OfferMeetEditPage.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Offer meet edit {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/users/client/components/SigninPage.component',
  () => () => <main>Sign in</main>,
);
jest.mock(
  '@/modules/users/client/components/SignupPage.component',
  () => () => <main>Sign up</main>,
);
jest.mock(
  '@/modules/users/client/components/ConfirmEmailPage.component',
  () => () => <main>Confirm email</main>,
);
jest.mock(
  '@/modules/users/client/components/ConfirmEmailInvalidPage.component',
  () => () => <main>Confirm email invalid</main>,
);
jest.mock(
  '@/modules/users/client/components/ForgotPasswordPage.component',
  () => () => <main>Forgot password</main>,
);
jest.mock(
  '@/modules/users/client/components/ResetPasswordPage.component',
  () => () => <main>Reset password</main>,
);
jest.mock(
  '@/modules/users/client/components/ResetPasswordSuccessPage.component',
  () => () => <main>Reset password success</main>,
);
jest.mock(
  '@/modules/users/client/components/ResetPasswordInvalidPage.component',
  () => () => <main>Reset password invalid</main>,
);
jest.mock(
  '@/modules/users/client/components/RemoveProfilePage.component',
  () => () => <main>Remove profile</main>,
);
jest.mock(
  '@/modules/users/client/components/ProfileSignupPage.component',
  () => () => <main>Profile signup</main>,
);
jest.mock('@/modules/users/client/components/ProfilePage.component', () => ({
  __esModule: true,
  default: ({ user }) => <main>Profile {user?.username}</main>,
}));
jest.mock(
  '@/modules/users/client/components/ProfileEditAbout.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Profile edit about {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/users/client/components/ProfileEditLocations.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Profile edit locations {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/users/client/components/ProfileEditPhoto.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Profile edit photo {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/users/client/components/ProfileEditNetworks.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Profile edit networks {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/users/client/components/ProfileEditAccount.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Profile edit account {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/contacts/client/components/ContactAddPage.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Contact add {user?.username}</main>,
  }),
);
jest.mock(
  '@/modules/contacts/client/components/ContactConfirmPage.component',
  () => ({
    __esModule: true,
    default: ({ user }) => <main>Contact confirm {user?.username}</main>,
  }),
);
jest.mock('@/modules/tribes/client/components/TribesPage.component', () => ({
  __esModule: true,
  default: ({ onMembershipUpdated, user }) => (
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
jest.mock(
  '@/modules/tribes/client/components/TribeDetailPage.component',
  () => ({
    __esModule: true,
    default: ({ onMembershipUpdated, user }) => (
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
  }),
);
/* eslint-enable react/display-name */

function renderRoute(route, user = { username: 'alice', public: true }) {
  const params =
    route.path === '/messages/:username'
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
      {route.render({ params, user })}
    </AppProviders>,
  );
}

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

  it('matches parametrised routes and exposes params', () => {
    expect(findRoute('/messages/alice')).toMatchObject({
      params: { username: 'alice' },
      path: '/messages/:username',
    });
    expect(matchReactRoute('/circles/hitchhikers')).toMatchObject({
      params: { circle: 'hitchhikers' },
    });
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
    expect(getReactRoutePolicy('/about')).toMatchObject({ redirectTo: '/' });
    expect(getReactRouteAccessRedirect(route, { roles: ['user'] })).toBe(
      '/volunteering',
    );
    expect(
      getReactRouteAccessRedirect(route, { roles: ['user', 'admin'] }),
    ).toBe(null);
    expect(
      getReactRouteAccessRedirect(getReactRoutePolicy('/support'), null),
    ).toBe(null);
    expect(
      getReactRouteAccessRedirect(getReactRoutePolicy('/messages'), null),
    ).toBe('/signin');
  });

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
    expect(
      getReactRouteAccessRedirect(getReactRoutePolicy('/profile/alice'), null),
    ).toBe('/signin');
  });

  it('does not claim remaining Angular-owned paths', () => {
    expect(isReactRoute('/profile-edit/about')).toBe(false);
    expect(findRoute('/profile-edit/about')).toBe(undefined);
  });

  it('renders every React-owned route', () => {
    routes.forEach(route => {
      const { container, unmount } = renderRoute(route);

      expect(container.firstChild).toBeTruthy();
      unmount();
    });
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
