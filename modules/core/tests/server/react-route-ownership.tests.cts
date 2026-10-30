const {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  isReactOwnedPath,
  matchReactRoute,
  normalizePath,
  routeRequiresAuth,
} = require('../../shared/react-route-ownership.mts');
const {
  REACT_ROUTE_POLICIES,
} = require('../../../../layers/shell/shared/route-manifest.mts');
const mainRouteTable = require('./fixtures/react-route-table.main.json');

const should: typeof import('should') = require('should');

describe('React route ownership', function () {
  it('allows administrators and support to review Experience changes', () => {
    const route = getReactRoutePolicy('/admin/experience-changes');
    for (const role of ['admin', 'support-team']) {
      should(getReactRouteAccessRedirect(route, { roles: [role] })).be.null();
    }
    for (const role of ['user', 'welcome-team']) {
      getReactRouteAccessRedirect(route, { roles: [role] }).should.equal(
        '/volunteering',
      );
    }
    getReactRouteAccessRedirect(route, null).should.equal('/signin');
  });

  it('owns username admin links with the same admin-only access as ID links', () => {
    const matched = matchReactRoute('/admin/user/fictional-member');
    should({ ...matched.params }).deepEqual({ username: 'fictional-member' });
    matched.policy.path.should.equal('/admin/user/:username');
    should(
      getReactRouteAccessRedirect(matched.policy, { roles: ['admin'] }),
    ).be.null();
    getReactRouteAccessRedirect(matched.policy, {
      roles: ['welcome-team'],
    }).should.equal('/volunteering');
    getReactRouteAccessRedirect(matched.policy, null).should.equal('/signin');
  });
  it('composes the module manifests into the route table from main', function () {
    const byPath = Object.fromEntries(
      REACT_ROUTE_POLICIES.map((policy: { path: string }) => [
        policy.path,
        policy,
      ]),
    );
    REACT_ROUTE_POLICIES.length.should.equal(83);
    should(byPath).deepEqual(mainRouteTable);
  });

  it('normalizes paths for server route selection', function () {
    normalizePath('/support/?report=alice').should.equal('/support');
    isReactOwnedPath('/support/?report=alice').should.be.true();
    normalizePath('/messages/alice/').should.equal('/messages/alice');
  });

  it('matches exact and parametrised route policies', function () {
    getReactRoutePolicy('/').should.containDeep({
      path: '/',
      title: 'Home',
    });
    getReactRoutePolicy('/messages/alice').should.containDeep({
      path: '/messages/:username',
      requiresAuth: true,
    });
    matchReactRoute('/messages/alice').should.containDeep({
      params: { username: 'alice' },
    });
    matchReactRoute('/circles/hitchhikers').should.containDeep({
      params: { circle: 'hitchhikers' },
      policy: {
        path: '/circles/:circle',
      },
    });
    matchReactRoute('/circles/naturists').should.containDeep({
      policy: {
        requiresAuthParams: {
          circle: ['naturists'],
        },
      },
    });
    matchReactRoute('/search').should.containDeep({
      policy: {
        path: '/search',
        requiresAuth: true,
      },
    });
    matchReactRoute('/search/members').should.containDeep({
      policy: {
        footerHidden: true,
        requiresAuth: true,
      },
    });
    matchReactRoute('/offer/meet/add').should.containDeep({
      policy: {
        path: '/offer/meet/add',
        requiresAuth: true,
      },
    });
  });

  it('defines protected admin route policy', function () {
    getReactRoutePolicy('/admin/').should.containDeep({
      footerVariant: 'admin',
      path: '/admin',
      requiresAuth: true,
      requiresRole: 'admin',
      title: 'Admin',
    });
  });

  it('returns access redirects for protected route policies', function () {
    const route = getReactRoutePolicy('/admin');

    getReactRouteAccessRedirect(route, null).should.equal('/signin');
    getReactRouteAccessRedirect(route, { roles: ['user'] }).should.equal(
      '/volunteering',
    );
    should(
      getReactRouteAccessRedirect(route, { roles: ['user', 'admin'] }),
    ).be.null();
    should(
      getReactRouteAccessRedirect(getReactRoutePolicy('/support'), null),
    ).be.null();
    getReactRouteAccessRedirect(
      getReactRoutePolicy('/messages'),
      null,
    ).should.equal('/signin');
    getReactRouteAccessRedirect(
      getReactRoutePolicy('/messages'),
      null,
      '/messages?filter=unread',
    ).should.equal(
      '/signin?continue=true&returnTo=%2Fmessages%3Ffilter%3Dunread',
    );
    getReactRouteAccessRedirect(
      getReactRoutePolicy('/circles/naturists'),
      null,
      '/circles/naturists',
    ).should.equal('/signin?continue=true&returnTo=%2Fcircles%2Fnaturists');
    should(
      getReactRouteAccessRedirect(
        getReactRoutePolicy('/circles/hitchhikers'),
        null,
        '/circles/hitchhikers',
      ),
    ).be.null();
  });

  it('evaluates exact parameter-based authentication requirements', function () {
    routeRequiresAuth(null, '/').should.be.false();
    routeRequiresAuth(
      getReactRoutePolicy('/messages'),
      '/messages',
    ).should.be.true();
    routeRequiresAuth(
      getReactRoutePolicy('/support'),
      '/support',
    ).should.be.false();
    routeRequiresAuth(
      getReactRoutePolicy('/circles/naturists'),
      '/circles/naturists',
    ).should.be.true();
    routeRequiresAuth(
      getReactRoutePolicy('/circles/hitchhikers'),
      '/circles/hitchhikers',
    ).should.be.false();
    routeRequiresAuth(
      getReactRoutePolicy('/circles/hitchhikers'),
      '/not-a-route',
    ).should.be.false();
  });

  it('matches profile and contact route policies', function () {
    getReactRoutePolicy('/profile/alice').should.containDeep({
      path: '/profile/:username',
      requiresAuth: true,
    });
    matchReactRoute('/profile/alice/experiences/new').should.containDeep({
      params: { username: 'alice' },
      policy: {
        path: '/profile/:username/experiences/new',
      },
    });
    getReactRoutePolicy('/contact-add/user-2').should.containDeep({
      path: '/contact-add/:userId',
      requiresAuth: true,
    });
  });

  it('does not claim legacy profile-edit paths', function () {
    isReactOwnedPath('/profile-edit/about').should.be.false();
  });
  it('allows either acquisition role while keeping other admin routes restricted', () => {
    for (const route of REACT_ROUTE_POLICIES.filter((route: { path: string }) =>
      route.path.startsWith('/admin'),
    )) {
      const acquisition =
        route.path.startsWith('/admin/acquisition-stories') ||
        route.path === '/admin/location-corrections';
      const staffSupport = route.path === '/admin/staff-blockers';
      should(
        getReactRouteAccessRedirect(route, { roles: ['welcome-team'] }),
      ).equal(acquisition || staffSupport ? null : '/volunteering');
      should(
        getReactRouteAccessRedirect(route, { roles: ['admin'] }),
      ).be.null();
      getReactRouteAccessRedirect(route, { roles: ['user'] }).should.equal(
        '/volunteering',
      );
      getReactRouteAccessRedirect(route, null).should.equal('/signin');
    }
  });
});

describe('Circle route ownership', () => {
  it('selects circle pages without claiming other workflows', () => {
    getReactRoutePolicy('/circles/').path.should.equal('/circles');
    matchReactRoute(
      '/circles/sample-circle/?from=profile',
    ).params.circle.should.equal('sample-circle');
    matchReactRoute('/circles/%73ample-circle').params.circle.should.equal(
      'sample-circle',
    );
    should(getReactRoutePolicy('/circles/sample/extra')).be.null();
    for (const path of [
      '/circles/%ZZ',
      '/circles/sample%2Fextra',
      '/circles/Hitchhikers',
      '/circles/sample_circle',
      '/circles/:circle',
    ]) {
      getReactRoutePolicy(path).path.should.equal('/not-found');
    }
  });
  it('preserves member-only circle access', () => {
    const route = getReactRoutePolicy('/circles/naturists');
    getReactRouteAccessRedirect(route, null, '/circles/naturists').should.equal(
      '/signin?continue=true&returnTo=%2Fcircles%2Fnaturists',
    );
    should(getReactRouteAccessRedirect(route, { roles: ['user'] })).be.null();
    should(
      getReactRouteAccessRedirect(
        getReactRoutePolicy('/circles/sample-circle'),
        null,
      ),
    ).be.null();
  });
});
