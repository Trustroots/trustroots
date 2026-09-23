const {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  isReactOwnedPath,
  normalizePath,
  REACT_OWNED_PATHS,
  REACT_ROUTE_POLICIES,
} = require('../../shared/react-route-ownership');

const should = require('should');

describe('React route ownership', function () {
  it('lists the first React-owned route group', function () {
    REACT_OWNED_PATHS.should.containEql('/support');
    REACT_OWNED_PATHS.should.containEql('/statistics');
    REACT_OWNED_PATHS.should.containEql('/faq/technology');
    REACT_OWNED_PATHS.should.containEql('/about');
    REACT_OWNED_PATHS.should.containEql('/not-found');
  });

  it('normalizes paths for server route selection', function () {
    normalizePath('/support/?report=alice').should.equal('/support');
    isReactOwnedPath('/support/?report=alice').should.be.true();
  });

  it('keeps route policies aligned with owned paths', function () {
    REACT_ROUTE_POLICIES.map(route => route.path)
      .sort()
      .should.deepEqual(REACT_OWNED_PATHS.slice().sort());
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
  });

  it('allows either acquisition role while keeping other admin routes restricted', () => {
    for (const route of REACT_ROUTE_POLICIES.filter(route =>
      route.path.startsWith('/admin'),
    )) {
      const acquisition = route.path.startsWith('/admin/acquisition-stories');
      should(
        getReactRouteAccessRedirect(route, { roles: ['welcome-team'] }),
      ).equal(acquisition ? null : '/volunteering');
      should(
        getReactRouteAccessRedirect(route, { roles: ['admin'] }),
      ).be.null();
      getReactRouteAccessRedirect(route, { roles: ['user'] }).should.equal(
        '/volunteering',
      );
      getReactRouteAccessRedirect(route, null).should.equal('/signin');
    }
  });

  it('does not claim Angular-owned routes', function () {
    isReactOwnedPath('/profile/edit').should.be.false();
  });
});

describe('Profile route ownership', () => {
  it('selects profile viewing tabs and requires sign-in', () => {
    for (const path of [
      '/profile/alice',
      '/profile/alice/about',
      '/profile/alice/overview',
      '/profile/alice/accommodation',
      '/profile/alice/contacts',
      '/profile/alice/tribes',
      '/profile/alice/experiences',
    ]) {
      const route = getReactRoutePolicy(path);
      route.requiresAuth.should.be.true();
      getReactRouteAccessRedirect(route, null).should.equal('/signin');
      should(getReactRouteAccessRedirect(route, { username: 'bob' })).be.null();
      route.params.username.should.equal('alice');
    }
    getReactRoutePolicy('/profile/%61lice').params.username.should.equal(
      'alice',
    );
  });

  it('does not select profile editors', () => {
    should(getReactRoutePolicy('/profile/edit')).be.undefined();
    should(getReactRoutePolicy('/profile/edit/photo')).be.undefined();
    getReactRoutePolicy('/profile/alice/experiences/new').path.should.equal(
      '/profile/:username/experiences/new',
    );
    for (const path of ['/profile/%ZZ', '/profile/%2F', '/profile/:username']) {
      getReactRoutePolicy(path).path.should.equal('/not-found');
    }
  });
});

describe('Circle route ownership', () => {
  it('selects circle pages without claiming other workflows', () => {
    getReactRoutePolicy('/circles/').path.should.equal('/circles');
    getReactRoutePolicy(
      '/circles/sample-circle/?from=profile',
    ).params.circle.should.equal('sample-circle');
    getReactRoutePolicy('/circles/%73ample-circle').params.circle.should.equal(
      'sample-circle',
    );
    should(getReactRoutePolicy('/circles/sample/extra')).be.undefined();
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
    getReactRouteAccessRedirect(route, null).should.equal('/signin');
    should(getReactRouteAccessRedirect(route, { roles: ['user'] })).be.null();
    should(
      getReactRouteAccessRedirect(
        getReactRoutePolicy('/circles/sample-circle'),
        null,
      ),
    ).be.null();
  });
});
