# Enforce module runtime source boundaries

## Why

Feature modules have separate `client`, `server` and `shared` source trees, but
the existing guards do not prevent runtime source from crossing those
boundaries. Such imports can make browser bundles depend on server code or
couple shared interfaces to one runtime.

## What changes

Add a production-source guard that rejects client-to-server and server-to-client
imports, and rejects shared-to-client or shared-to-server imports. Apply it to
all modules and resolve the same supported literal import forms as the existing
module boundary guard. Keep tests excluded and keep the existing module graph
guard authoritative for dependencies between modules.

## Scope

This change does not define model ownership, layer-to-app dependencies or
module-to-module dependency policy. It does not move source or change runtime
behaviour.
