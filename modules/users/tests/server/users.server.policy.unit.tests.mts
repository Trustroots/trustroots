import 'should';
import policy, {
  isSupportProfileRead,
} from '../../server/policies/users.server.policy.mts';
import {
  assertGrants,
  policyRequest,
  policyResponse,
} from '../../../../testutils/server/route-grants.server.testutil.mts';

const profilePath = '/api/users/:username';
const avatarPath = '/api/users/:avatarUserId/avatar';

function decide({
  roles,
  path = profilePath,
  method = 'GET',
  viewerPublic = false,
  profilePublic = false,
  ownProfile = false,
}: {
  roles?: string[];
  path?: string;
  method?: string;
  viewerPublic?: boolean;
  profilePublic?: boolean;
  ownProfile?: boolean;
}) {
  const req = {
    ...policyRequest('user', path, method),
    profile: { _id: { equals: () => ownProfile }, public: profilePublic },
  };
  req.user!.roles = roles;
  req.user!.public = viewerPublic;
  const res = policyResponse();
  let permitted = false;
  policy.isAllowed(req, res, () => {
    permitted = true;
  });
  return permitted ? 200 : res.statusCode;
}

describe('Users policy unit tests', () => {
  it('grants exactly the documented permissions per role', () => {
    assertGrants(policy.isAllowed, [
      'user GET /api/users',
      'user PUT /api/users',
      'user DELETE /api/users',
      `user GET ${profilePath}`,
      `admin GET ${profilePath}`,
      `support-team GET ${profilePath}`,
      `user GET ${avatarPath}`,
      `admin GET ${avatarPath}`,
      'user GET /api/users/mini/:userId',
      'user POST /api/users/password',
      'user DELETE /api/users/accounts/:provider',
      'user GET /api/users/memberships',
      'user POST /api/users/memberships/:tribeId',
      'user DELETE /api/users/memberships/:tribeId',
      'user GET /api/users/export',
      'user GET /api/users/removal/pending',
      'user DELETE /api/users/removal/pending',
      'user POST /api/users/nostr/challenge',
      'user DELETE /api/users/remove/:token',
      'user POST /api/users-avatar',
      'user POST /api/users/push/registrations',
      'user DELETE /api/users/push/registrations/:token',
      'user GET /api/users/unified-push',
      'user POST /api/users/unified-push',
      'user DELETE /api/users/unified-push',
      'user POST /api/users/unified-push/test',
      'user GET /api/blocked-users',
      'user PUT /api/blocked-users/:username',
      'user DELETE /api/blocked-users/:username',
    ]);
  });

  it('recognises only support-team GET requests to the username profile route', () => {
    const user = { roles: ['support-team'] };
    const route = { path: profilePath };
    isSupportProfileRead({ user, route, method: 'GET' }).should.be.true();
    for (const request of [
      { user, method: 'GET' },
      { user, route: { path: avatarPath }, method: 'GET' },
      { user, route, method: 'PUT' },
      { route, method: 'GET' },
      { user: {}, route, method: 'GET' },
      { user: { roles: ['admin'] }, route, method: 'GET' },
    ]) {
      isSupportProfileRead(request).should.be.false();
    }
  });

  it('hides unpublished profiles from other members with 404', () => {
    decide({ roles: ['user'], viewerPublic: true }).should.equal(404);
  });

  it('refuses unpublished members browsing other profiles with 403', () => {
    decide({ roles: ['user'], profilePublic: true }).should.equal(403);
  });

  it('lets members past the visibility checks on their own profile', () => {
    decide({ roles: ['user'], ownProfile: true }).should.equal(200);
  });

  it('applies the hidden profile exceptions only to the intended staff reads', () => {
    for (const [roles, path, method, status] of [
      [['support-team'], profilePath, 'GET', 200],
      [['admin'], profilePath, 'GET', 200],
      [['admin'], avatarPath, 'GET', 200],
      [['support-team'], avatarPath, 'GET', 404],
      [['support-team'], profilePath, 'PUT', 404],
      [['admin'], profilePath, 'PUT', 404],
      [['admin'], avatarPath, 'POST', 404],
      [['admin'], '/api/users/mini/:userId', 'GET', 404],
      [undefined, profilePath, 'GET', 404],
      [undefined, avatarPath, 'GET', 404],
    ] as const) {
      decide({ roles: roles && [...roles], path, method }).should.equal(status);
    }
  });
});
