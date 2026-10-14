import type {
  MemoryPolicy,
  PolicyDecisionCallback,
  PolicyRule,
} from './policy-types.server.mts';

/**
 * The route policies only need in-memory grants keyed by role, route pattern
 * and HTTP method. Keep each policy's grants isolated in its own instance.
 */
export function createMemoryPolicy(): MemoryPolicy {
  const grants = new Map<string, Map<string, Set<string>>>();
  function allow(rules: PolicyRule[]): void {
    rules.forEach(function ({ roles, allows }) {
      roles.forEach(function (role) {
        let roleGrants = grants.get(role);
        if (!roleGrants) {
          roleGrants = new Map();
          grants.set(role, roleGrants);
        }
        allows.forEach(function ({ resources, permissions }) {
          let methods = roleGrants.get(resources);
          if (!methods) {
            methods = new Set();
            roleGrants.set(resources, methods);
          }
          const allowedMethods: string[] = Array.isArray(permissions)
            ? permissions
            : [permissions];
          allowedMethods.forEach(method => methods.add(method));
        });
      });
    });
  }
  function areAnyRolesAllowed(
    roles: string[],
    resource: string,
    permission: string,
  ): Promise<boolean>;
  function areAnyRolesAllowed(
    roles: string[],
    resource: string,
    permission: string,
    callback: PolicyDecisionCallback,
  ): unknown;
  function areAnyRolesAllowed(
    roles: string[],
    resource: string,
    permission: string,
    callback?: PolicyDecisionCallback,
  ): Promise<boolean> | unknown {
    const isAllowed = roles.some(function (role) {
      const methods = grants.get(role)?.get(resource);
      return methods ? methods.has(permission) || methods.has('*') : false;
    });
    if (callback) {
      return callback(null, isAllowed);
    }
    return Promise.resolve(isAllowed);
  }
  return {
    allow,
    areAnyRolesAllowed,
  };
}
const defaultInterop = createMemoryPolicy;
export default defaultInterop;
export { defaultInterop as 'module.exports' };
