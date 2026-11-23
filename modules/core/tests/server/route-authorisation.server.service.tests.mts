import 'should';
import { isRouteAllowed } from '../../server/services/route-authorisation.server.service.mts';

const grants = {
  '/api/examples': { guest: ['get'], member: ['get', 'post'] },
};

function request(roles: string[] | undefined, path: string, method: string) {
  return {
    user: roles && { roles, _id: { valueOf: () => 'member-id' } },
    route: { path },
    method,
  };
}

describe('Route authorisation service', () => {
  it('allows a method when any one of the roles grants it', () => {
    isRouteAllowed(
      grants,
      request(['other', 'member'], '/api/examples', 'POST'),
    ).should.be.true();
    isRouteAllowed(
      grants,
      request(['other'], '/api/examples', 'GET'),
    ).should.be.false();
  });

  it('treats signed-out requests and members without roles as guests', () => {
    isRouteAllowed(
      grants,
      request(undefined, '/api/examples', 'GET'),
    ).should.be.true();
    isRouteAllowed(
      grants,
      request(undefined, '/api/examples', 'POST'),
    ).should.be.false();
    const roleless = {
      ...request([], '/api/examples', 'GET'),
      user: { _id: { valueOf: () => 'member-id' } },
    };
    isRouteAllowed(grants, roleless).should.be.true();
  });

  it('denies routes, roles and methods without a grant, including prototype names', () => {
    isRouteAllowed(
      grants,
      request(['member'], '/api/unknown', 'GET'),
    ).should.be.false();
    isRouteAllowed(
      grants,
      request(['member'], 'constructor', 'GET'),
    ).should.be.false();
    isRouteAllowed(
      grants,
      request(['constructor', 'toString'], '/api/examples', 'GET'),
    ).should.be.false();
    isRouteAllowed(
      grants,
      request([], '/api/examples', 'GET'),
    ).should.be.false();
  });
});
