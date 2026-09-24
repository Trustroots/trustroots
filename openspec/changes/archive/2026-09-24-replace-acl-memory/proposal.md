## Why

The unmaintained `acl` package installs obsolete MongoDB and Redis clients even
though Trustroots only uses its in-memory role permissions. Its bundled
MongoDB 2.x client leaves Dependabot alert #25 open after the application
database driver upgrades.

## What Changes

- Replace the memory-only `acl` usage in route policies with a small local
  permission store.
- Preserve existing role, route and HTTP-method grants, including wildcard
  permissions, any-role checks, callback callers and promise callers.
- Remove `acl` and its unused database backends from the dependency graph.

## Impact

All eight server policy modules and their tests change. There is no stored ACL
data or database migration. A rollback restores the previous application
package and lockfile.
