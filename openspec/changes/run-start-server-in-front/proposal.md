# Run the TanStack Start server in front of Express

## Why

Express is the only HTTP server; Start's server bundle only prerenders the SPA
shell at build time. To move endpoints to Start server routes one at a time,
Start has to receive the requests first, with Express still answering
everything that has not moved.

## What Changes

- Outside development, the HTTP server hands each request to Start's built
  server (`build/start-server/server.js`).
- The server router's catch-all route has a request middleware that marks
  every request no Start route matches; the HTTP server then lets Express
  answer it on the untouched Node request and response, so Express's
  response never passes through Start. With no fallback in the request
  context, as during the shell prerender, Start renders the shell as before.
- No routes move yet, so every request still reaches Express. Start answers
  protocol-relative paths (`//host/path`) with a same-origin 308 redirect.
- Development is unchanged: Vite serves `/assets/` and proxies the rest to
  Express.
- `srvx` (already installed with Start) becomes a direct dependency for the
  Node request adapter.

## Affected modules

- `layers/shell` (server router entry)
- `config/lib/app.mts`
- Documentation for the Vite and Start build

## Compatibility and deployment

No member-facing, API or data changes. `pnpm build` already produces the Start
server bundle; deployments must ship `build/start-server` with the other
built assets, and production fails at start-up when it is missing. Passenger
keeps starting `server.js`.
