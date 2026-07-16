# Tasks

## 1. Server removal

- [x] 1.1 Delete the Facebook and GitHub passport strategies and Facebook Graph
      API wrapper
- [x] 1.2 Remove the social authentication and Facebook token-refresh routes
- [x] 1.3 Remove the `/api/auth/facebook*` and `/api/auth/github*` ACL entries
- [x] 1.4 Remove social OAuth client configuration and Facebook layout exposure
- [x] 1.5 Keep Facebook, GitHub, and Twitter in the provider-removal allowlist
      so legacy data can still be disconnected

## 2. Client removal

- [x] 2.1 Remove the connectable networks section and move legacy Facebook,
      GitHub, and Twitter data below Save with Delete controls
- [x] 2.2 Remove automatic Facebook SDK initialisation and token refresh
- [x] 2.3 Keep Facebook sharing as a direct sharing link
- [x] 2.4 Update privacy and FAQ copy for legacy provider data
- [x] 2.5 Label Facebook and GitHub statistics as legacy connections and tidy
      the network statistics layout with one-decimal percentages
- [x] 2.6 Place Nostroots above the hospitality networks and link to its web client

## 3. Dependencies

- [x] 3.1 Remove `fbgraph`, `passport-facebook`, and `passport-github`, then
      refresh the lockfile

## 4. Tests

- [x] 4.1 Remove obsolete social strategy, callback, token-refresh, and SDK tests
- [x] 4.2 Update route and account-access coverage assertions
- [x] 4.3 Add end-to-end coverage that social OAuth cannot be newly connected
      while stored provider data remains disconnectable
- [x] 4.4 Keep avatar, profile, statistics, and admin tests for stored provider data
- [x] 4.5 Cover the legacy statistics labels in the statistics component tests
- [x] 4.6 Verify server and client coverage remain at 100% and end-to-end
      coverage is not reduced
