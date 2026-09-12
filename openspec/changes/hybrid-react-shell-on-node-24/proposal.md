## Why

Trustroots still boots most of the member experience through AngularJS while a
React shell already exists for public pages and administration on a parallel
branch. On the Node.js 24 / Webpack 5 runtime we need that shell in-tree so we
can migrate remaining routes off Angular, modernise the shared CSS stack after
Angular is gone, and retire unused push-client paths—without changing the
MongoDB or Redis data layer in this change.

## What Changes

- Land the hybrid React client shell on the Node.js 24 branch with dual Webpack
  entries (`main` for Angular, `react-main` for React-owned routes).
- Serve public informational pages and administration through React route
  ownership while Angular continues to own the remaining member surfaces.
- Sequentially finish Angular→React cutover for auth, profile, search, offers,
  messages, contacts, and circles, then remove Angular client dependencies.
- Upgrade the completed client to React 18 and replace hand-written route
  matching and History API observation with TanStack Router.
- After Angular removal, upgrade Bootstrap 3 to Bootstrap 5 and align
  `react-bootstrap` APIs.
- Remove the unused Expo push path and upgrade the optional Firebase client
  messaging stack.
- **Non-goals:** mongoose / mongodb / bson / acl / agenda / redis majors or
  schema migrations.

## Capabilities

### New Capabilities

- `client-shell`: Defines how the server chooses Angular versus React document
  shells and which paths React owns, including auth and role gates for admin
  routes.

### Modified Capabilities

- `site-presentation`: Shared footer and navigation remain consistent when
  pages render through the React shell.

## Impact

Affects the Node.js runtime, Webpack client entries, Express HTML rendering,
React mounting and routing, `react-route-ownership`, administration and public
page mounting, and later Bootstrap / push dependencies. No database migration.
Deployments rebuild the application image. Rollback uses the previous image.
Public pages and administration become React-owned first; remaining Angular
routes migrate in later stages of this change.
