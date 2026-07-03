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
      footerHidden: true,
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

  it('does not claim Angular-owned routes', function () {
    isReactOwnedPath('/profile/alice').should.be.false();
  });
});
