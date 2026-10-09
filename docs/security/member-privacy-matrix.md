# Member privacy boundary regression matrix

This matrix records the intended behaviour at member-facing data boundaries.
The tests use generated accounts and fictional fixture values. A role in the
table describes the viewer unless the surface says otherwise.

| Surface          | Anonymous visitor | Available member                                                                       | Blocked member                                                                                                           | Suspended or shadowbanned member                                                                            | Administrator                                                                              |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Profile API      | Denied (403)      | Can read another available profile; only approved public fields are returned           | A member who blocked the viewer is unavailable; the blocker can still open the blocked member's profile to reach unblock | Restricted profiles are unavailable to regular viewers; a restricted viewer's own profile remains available | Can inspect restricted member profiles                                                     |
| Avatar           | Denied (403)      | Public avatar is available                                                             | The blocked viewer gets a default avatar; the blocker can see the blocked member's avatar                                | Restricted member avatars resolve to the default avatar                                                     | Can inspect restricted avatars                                                             |
| Member search    | Denied (403)      | Public, available matches only; either-direction blocks are filtered                   | Either-direction blocked matches are omitted                                                                             | Suspended and shadowbanned profiles are omitted                                                             | Use the admin member-search surface for moderation; regular member search remains filtered |
| Private messages | Denied (403)      | Authenticated participants can read their thread; inbox excerpts omit message bodies   | Block rules prevent prohibited starts or continuations                                                                   | Shadow-hidden messages are hidden from regular recipients; administrators can inspect them                  | Can inspect shadow-hidden message context                                                  |
| Data export      | Denied (403)      | Authenticated account holder can export their own profile, contacts and hosting offers | Export remains scoped to the signed-in account                                                                           | Export remains scoped to the signed-in account                                                              | Export remains scoped to the signed-in account                                             |

The explicitly public profile contract includes display identity, the member's
chosen home and origin place labels, profile text, languages, avatar metadata,
membership and volunteer status, and approved external identity links. The
home and origin values are member-entered place labels. The profile API has no
precise-coordinate or street-address fields. Account credentials, contact
details, block lists, moderation roles, provider tokens, push tokens, and
future unapproved fields remain private.

Search requests enforce a bounded query length, result count and page range.
Location text can be searched because it is part of the public profile
contract. Search result projections contain only approved card fields.

Avatar URLs use generated version directories for processed uploads and a
member update timestamp as a cache buster for legacy local uploads. Profile
responses depend on the signed-in viewer and must not be served from a public
shared cache. Temporary avatar redirects are not given a public cache policy.

## Regression coverage

- Profile response allowlisting and the public place-label/private-coordinate
  boundary: `modules/users/tests/server/services/profile-response.server.service.tests.js`,
  `modules/users/tests/server/user-profile.server.controller.unit.tests.js`,
  and `tests/e2e/features/profile-onboarding/authenticated.spec.js`.
- Avatar privacy by visibility, block direction, moderation role, and upload
  cache-busting: `modules/users/tests/server/users.avatar.server.controller.unit.tests.js`,
  `modules/users/tests/server/user-avatar.server.routes.tests.js`, and
  `tests/e2e/features/relationships-safety/contacts-and-blocks.spec.js`.
- Search visibility, location text, pagination and result caps:
  `modules/users/tests/server/search-users.server.routes.tests.js` and
  `tests/e2e/features/profile-onboarding/authenticated.spec.js`.
- Message authentication, pagination, shadow-hidden delivery and moderation
  access: `modules/messages/tests/server/message.server.routes.tests.js`,
  `modules/messages/tests/server/messages.server.controller.unit.tests.js`,
  `tests/e2e/features/messages/messages-api.spec.js`, and
  `tests/e2e/features/admin-moderation/admin-inspection.spec.js`.
- Export authentication and payload shape:
  `modules/users/tests/server/users.server.policy.unit.tests.js`,
  `modules/users/tests/server/controllers/users.export.server.controller.unit.tests.js`,
  and `tests/e2e/features/profile-onboarding/authenticated.spec.js`.
