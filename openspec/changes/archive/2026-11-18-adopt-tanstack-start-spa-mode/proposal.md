# Adopt TanStack Start in SPA mode

## Why

The web client already uses React 19, TanStack Router and TanStack Query on
Vite. TanStack Start adds server rendering, route loaders and server functions
on top of the same router. Moving the build onto Start in SPA mode first keeps
every page client-rendered while the build, the document shell and the Express
integration change, so server rendering can follow in smaller steps.

## What Changes

- Vite builds the client with the `@tanstack/react-start` plugin, SPA mode
  enabled. The code-based route tree stays as it is.
- Start prerenders the document shell to `public/assets/_shell.html`. The
  client entry hydrates Start's router inside the existing app providers.
- Express remains the only server. `renderIndex` serves the Start shell instead
  of the nunjucks page layout, adding the page head (title, description, social
  preview tags, Umami template), the bootstrap data and a CSP nonce on every
  script. Server-side redirects for guarded routes, circle data on
  `/circles/:tribe` and the signup invite tags are unchanged.
- In development Express fetches the shell from the Vite development server,
  which renders it on each request.
- The JavaScript bundle becomes ES modules with a hashed `react-main-*.js`
  entry. `react-main.css` and `react-main.rtl.css` keep their names; the RTL
  stylesheet plugin runs for the client build only.
- Express error pages (404, 500, suspended) keep the nunjucks layout and load
  only the stylesheet.

## Affected modules

- `layers/shell` (router entry, shell document, root route)
- `config/vite` and `vite.config.mts`
- `modules/core` (index controller, shell service, page templates)
- `config/lib/express.mts` asset locals
- Vite smoke tests, end-to-end client build and the Umami start-up spec

## Compatibility and deployment

No member-facing behaviour, stored data or API changes. `pnpm build` still
produces everything Express serves, so the production image and deploy need no
changes. Deployments must ship `public/assets/_shell.html` with the other built
assets; production fails loudly when it is missing.

## Follow-ups

Server rendering, route loaders and a single route guard shared by Express and
the client are separate changes.
