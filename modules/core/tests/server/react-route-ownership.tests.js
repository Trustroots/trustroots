const {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  isReactOwnedPath,
  matchReactRoute,
  normalizePath,
  REACT_OWNED_PATHS,
  REACT_ROUTE_POLICIES,
  routeRequiresAuth,
} = require('../../shared/react-route-ownership');

const should = require('should');

describe('React route ownership', function () {
  it('lists the first React-owned route group', function () {
    REACT_OWNED_PATHS.should.containEql('/support');
    REACT_OWNED_PATHS.should.containEql('/statistics');
    REACT_OWNED_PATHS.should.containEql('/safety');
    REACT_OWNED_PATHS.should.containEql('/faq/technology');
    REACT_OWNED_PATHS.should.containEql('/');
    REACT_OWNED_PATHS.should.containEql('/messages/:username');
    REACT_OWNED_PATHS.should.containEql('/signin');
    REACT_OWNED_PATHS.should.containEql('/remove/:token');
  });

  it('normalizes paths for server route selection', function () {
    normalizePath('/support/?report=alice').should.equal('/support');
    isReactOwnedPath('/support/?report=alice').should.be.true();
    normalizePath('/messages/alice/').should.equal('/messages/alice');
  });

  it('keeps route policies aligned with owned paths', function () {
    REACT_ROUTE_POLICIES.map(route => route.path)
      .sort()
      .should.deepEqual(REACT_OWNED_PATHS.slice().sort());
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

  it('does not claim legacy Angular profile-edit paths', function () {
    isReactOwnedPath('/profile-edit/about').should.be.false();
  });
});
