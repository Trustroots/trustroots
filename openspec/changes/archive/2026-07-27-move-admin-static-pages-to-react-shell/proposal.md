# Move admin and static pages to the React shell

## Why

Trustroots currently boots the legacy Angular application even for pages whose
content is already implemented as React components. Administration and
read-only informational pages can move first because they have clear route
boundaries and do not depend on Angular-managed member workflows.

## What Changes

- Add a React application entry point and server-rendered root alongside the
  existing Angular application.
- Route administration pages, statistics, support/contact, FAQ pages, and
  read-only informational pages to the React shell.
- Preserve the existing `/about` redirect and provide the not-found component
  through the React route table.
- Keep all member profiles, circles, search, offers, messaging, and
  authentication routes on Angular.
- Enforce admin route access on both the server and the React client.
- Keep a temporary Angular compatibility bridge for links and code that still
  navigate between the two application roots.

## Affected Modules

- `config/webpack` and `config/lib/express.js`
- `modules/core` (shell, route ownership, server root selection)
- `modules/admin`, `modules/pages`, `modules/statistics`, and `modules/support`
- `tests/e2e` (route access and page-loading coverage)
