# Start the server ESM migration

## Why

Server modules still use CommonJS while client code uses ESM. Converting the
server in one step would also change how existing CommonJS tests and loaders
resolve modules. Establishing a native ESM boundary with a compatible import
path lets server modules move incrementally without changing member behaviour.

## What Changes

- Move the shared text sanitisation service to native ESM with named exports.
- Keep its existing CommonJS path available to current server consumers during
  the transition.
- Verify that both module systems expose the same service functions and options.

## Impact

This is the first stage of #2857. The server entry points and other server
modules remain on CommonJS until later stages. The Node.js 24 runtime, API
responses, stored data, and browser behaviour remain unchanged.
