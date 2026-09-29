# Remove Gulp from application tooling

## Why

Gulp now only wraps Nodemon and the server test runner. Keeping it adds a build tool and transitive dependencies without providing asset build functionality.

## What Changes

- Run the server and worker through a standalone Nodemon script.
- Run server tests through a standalone Node script, with Nodemon for watch mode.
- Remove Gulp, its configuration, and its dependency and lockfile entries.

## Impact

Development startup, production startup, and server test commands are affected. Their public npm command names and application behaviour remain the same. No data migration or deployment configuration change is needed.
