# Remove Twitter OAuth connect

## Why

Twitter (now X) shut down the free v1.1 OAuth 1.0a API that our
`passport-twitter` integration depends on, so the "connect Twitter" flow has
been non-functional for a long time. The strategy, its routes, and the
unmaintained `passport-twitter` dependency are dead weight.

## What Changes

- Remove the Twitter OAuth connect flow: the passport strategy, the
  `/api/auth/twitter` and `/api/auth/twitter/callback` routes, their ACL
  entries, and the OAuth client configuration.
- Remove Twitter from the "connect a network" choices on the profile networks
  edit page. Facebook and GitHub remain connectable.
- Drop the `passport-twitter` npm dependency.
- Update privacy page copy that lists Twitter as a connectable network.

## What Stays the Same

- Members who connected Twitter in the past keep their stored data; their
  Twitter username continues to be shown on their profile.
- Members can still disconnect Twitter from their account settings, which
  removes the stored data (the generic disconnect endpoint keeps accepting
  `twitter` as a provider).
- Statistics and admin tooling that count or obfuscate stored Twitter data
  are unaffected.
- The organisation's own Twitter links, Twitter Card metadata, and the tweet
  share widget are unrelated to OAuth and are unaffected.

## Affected Modules

- `modules/users` (server strategy, routes, policy, client networks edit view,
  tests)
- `modules/pages` (privacy copy)
- `config/env/default.js` (OAuth client settings; the organisation `username`
  setting stays)
- `deploy` (legacy nginx callback rewrite)

## Compatibility and Deployment

- No data migration: `additionalProvidersData.twitter` documents are kept
  as-is.
- Requests to `/api/auth/twitter` will return 404 after deployment; the flow
  they belong to has been broken upstream for years, so no working behaviour
  is lost.
- No configuration changes are required in production; unused
  `twitter.clientID`/`clientSecret` values in local configuration are simply
  ignored.
