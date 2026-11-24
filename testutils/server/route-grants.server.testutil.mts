import assert from 'node:assert';
import type {
  PolicyRequest,
  PolicyResponse,
} from '../../modules/core/server/services/policy-types.server.mts';

const roles = [
  'guest',
  'admin',
  'welcome-team',
  'support-team',
  'moderator',
  'flagged',
  'shadowban',
  'suspended',
  'user',
  'volunteer-alumni',
  'volunteer',
];
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export interface PolicyResponseDouble extends PolicyResponse {
  statusCode: number;
  body: { message: string } | null;
}

export function policyResponse(): PolicyResponseDouble {
  const res: PolicyResponseDouble = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

/** A published member holding exactly the given role, or a guest. */
export function policyRequest(
  role: string,
  path: string,
  method: string,
): PolicyRequest {
  return {
    user:
      role === 'guest'
        ? undefined
        : { roles: [role], public: true, _id: { valueOf: () => 'member-id' } },
    route: { path },
    method,
  };
}

/**
 * Assert the whole role matrix of a policy: across every role and method, the
 * routes named in `expected` let through exactly the listed `role METHOD path`.
 */
export function assertGrants(
  isAllowed: (req: never, res: never, next: () => void) => unknown,
  expected: string[],
): void {
  const paths = [...new Set(expected.map(grant => grant.split(' ')[2]))];
  const granted = paths.flatMap(path =>
    roles.flatMap(role =>
      methods
        .filter(method => {
          let isGranted = false;
          isAllowed(
            policyRequest(role, path, method) as never,
            policyResponse() as never,
            () => {
              isGranted = true;
            },
          );
          return isGranted;
        })
        .map(method => `${role} ${method} ${path}`),
    ),
  );
  assert.deepStrictEqual(granted.sort(), [...expected].sort());
}
