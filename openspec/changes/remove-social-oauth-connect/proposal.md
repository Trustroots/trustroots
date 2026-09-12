# Remove Facebook and GitHub OAuth connect

## Why

The social OAuth integrations are old account-linking features rather than
sign-in methods. The Facebook flow uses an obsolete Graph API version and the
unmaintained `fbgraph` client, while both flows add third-party authentication
surface and legacy dependencies for little current value. Trustroots accounts
continue to use local username or email credentials.

## What Changes

- Remove the Facebook and GitHub OAuth connect flows: their passport
  strategies, `/api/auth/facebook*` and `/api/auth/github*` routes, ACL entries,
  and OAuth client configuration.
- Remove the "connect a network" choices from the profile networks edit page
  and show any legacy Facebook, GitHub, or Twitter data below Save with only a
  Delete action.
- Remove automatic Facebook token refresh and the Facebook JavaScript SDK.
- Drop `fbgraph`, `passport-facebook`, and `passport-github`.
- Update privacy and FAQ copy to describe social provider data as legacy data
  rather than a connectable account.
- Mark Facebook and GitHub connection statistics as legacy data and improve the
  readability of the network statistics card, including one-decimal
  percentages so smaller networks are not displayed as zero.
- Place the Nostroots identity section first on the networks form and link it
  to the Nostroots web client.

## What Stays the Same

- Members who connected Facebook or GitHub in the past keep their stored data.
- Existing Facebook avatar selections continue to use the stored Facebook ID.
- Members can still disconnect Facebook, GitHub, or Twitter from account
  settings, which removes the stored provider data.
- Facebook sharing links and the organisation's public Facebook and GitHub
  links remain.
- Statistics, profile display, and admin tooling that read or redact stored
  provider data remain.

## Affected Modules

- `modules/users` (server strategies, routes, controller, policy, profile
  network view, authentication client, and tests)
- `modules/core` (Facebook SDK service, sharing directive, layout, and tests)
- `modules/pages` (privacy and FAQ copy)
- `modules/statistics` (legacy labels and network statistics presentation)
- `config` (social OAuth client settings)
- `tests/e2e` (account access coverage catalogue and regression coverage)

## Compatibility and Deployment

- No data migration: existing `additionalProvidersData.facebook`,
  `additionalProvidersData.github`, and `additionalProvidersData.twitter`
  documents remain unchanged.
- Requests to `/api/auth/facebook*` and `/api/auth/github*` return 404 after
  deployment.
- Production Facebook and GitHub OAuth credentials become unused and can be
  removed from deployment secrets separately.
- Existing Facebook avatar URLs still depend on Facebook serving an image for
  the stored ID; that external behaviour is unchanged by this removal.
