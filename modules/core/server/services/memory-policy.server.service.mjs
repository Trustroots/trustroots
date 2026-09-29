/**
 * The route policies only need in-memory grants keyed by role, route pattern
 * and HTTP method. Keep each policy's grants isolated in its own instance.
 */
export function createMemoryPolicy() {
  const grants = new Map();

  function allow(rules) {
    rules.forEach(function ({ roles, allows }) {
      roles.forEach(function (role) {
        if (!grants.has(role)) {
          grants.set(role, new Map());
        }
        const roleGrants = grants.get(role);

        allows.forEach(function ({ resources, permissions }) {
          if (!roleGrants.has(resources)) {
            roleGrants.set(resources, new Set());
          }
          const methods = roleGrants.get(resources);
          const allowedMethods = Array.isArray(permissions)
            ? permissions
            : [permissions];
          allowedMethods.forEach(method => methods.add(method));
        });
      });
    });
  }

  function areAnyRolesAllowed(roles, resource, permission, callback) {
    const isAllowed = roles.some(function (role) {
      const methods = grants.get(role)?.get(resource);
      return methods?.has(permission) || methods?.has('*') || false;
    });

    if (callback) {
      return callback(null, isAllowed);
    }
    return Promise.resolve(isAllowed);
  }

  return { allow, areAnyRolesAllowed };
}
