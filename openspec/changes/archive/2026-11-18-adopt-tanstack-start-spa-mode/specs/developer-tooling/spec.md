## MODIFIED Requirements

### Requirement: Production client build uses Vite

The production build command SHALL build the client with Vite and the TanStack
Start plugin in SPA mode, emitting the prerendered document shell
`_shell.html`, an ES module entry `react-main-<hash>.js`, `react-main.css`, and
`react-main.rtl.css` at the paths Express serves. Vite SHALL be the only
supported client build tool in development, production, and end-to-end CI;
Webpack fallback commands SHALL NOT be provided.

#### Scenario: Production build

- **WHEN** the production build command runs
- **THEN** Vite emits the shell, the client JavaScript and both stylesheets under `public/assets`
- **AND** unrelated generated files outside that asset build are left in place

#### Scenario: Client-rendered page request

- **WHEN** a browser requests a client-rendered page that needs no server-side redirect
- **THEN** Express responds with the Start shell, including the page title, social preview tags and bootstrap data
- **AND** every script in the response carries the request's CSP nonce

#### Scenario: Development and browser tests

- **WHEN** a developer starts the application or CI builds browser test assets
- **THEN** development uses the Vite server, which renders the shell for Express on each request, and browser tests use the Vite production assets
- **AND** Windows browser tests use the same client build as other end-to-end jobs
