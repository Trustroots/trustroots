# Vite client

`pnpm start` serves the React shell with Vite. Open <http://localhost:3000>.
Vite serves `/assets/*` and proxies other requests to Express on port 3001.
Set `PORT` for Vite's browser port and `TRUSTROOTS_API_URL` for the Express
target when using different ports.

Vite and ESLint share client aliases from `config/client/aliases.mts` and the
main stylesheet from `config/client/styles/main.less`. ESLint keeps the
TypeScript resolver's extension mappings. Vite resolves an explicit `.js`
import to the `.js` file, then `.ts`, then `.tsx`.

Vite compiles styles with Less 4 and enables legacy arithmetic so existing
unparenthesised divisions retain their behaviour. Module styles are imported
after Bootstrap. Vite prepends `import.meta.glob` imports, so that glob lives in
its own module; otherwise Bootstrap's later focus rules override app styles of
equal specificity.

The client builds with the TanStack Start Vite plugin in SPA mode. Start
generates the route tree, `layers/shell/client/routeTree.gen.ts`, from the
files in `layers/shell/client/routes/`. Start's router
entry, `layers/shell/client/start-router.tsx`, gives the browser the app routes
and gives Start's server bundle only the document shell, so browser-only page
modules are never imported in Node. Express is still the only server: Start's
server bundle is used at build time only.

`pnpm build:vite` prerenders that shell to `public/assets/_shell.html` and
emits an ES module entry `react-main-<hash>.js` with its chunks,
`react-main.css`, and `react-main.rtl.css`. The RTL file is produced with
`rtlcss` from the client build, and the client loads it for right-to-left
languages. The build keeps other files in `public/assets`. `pnpm build` runs
this Vite build for production images.

For client-rendered pages Express reads the shell once and adds the page head
(`modules/core/server/views/index.mts`: title, description, social preview tags,
Umami template and bootstrap data) and the request's CSP nonce on every
script. In development it fetches the shell from the Vite server on each
request instead, on the port Vite takes from `PORT` (3000 by default); set
`TRUSTROOTS_VITE_URL` when Vite runs on another host. A server error and a suspended account get static HTML pages
(`modules/core/server/views/500.html`, `modules/users/server/views/suspended.html`);
every other page, including not-found, is the app.

After building Vite, run `pnpm test:vite:production`. This browser smoke test
serves the Start shell with Express's page head and locals to load the bundle
and CSS on public pages, including home, about, contact, contribute, FAQ
sections, foundation, guide, media, rules, statistics, support, team,
greeters, volunteering, circles, privacy, safety, password and
email-confirmation states, and sign-in. It also loads the RTL stylesheet with
an Arabic language cookie. It requires Playwright's Chromium browser (`pnpm
exec playwright install chromium`), already included in the development
container. It checks script execution, CSP nonces on every script and route
rendering without a database. Map, circle-detail, and signed-in routes stay in
the end-to-end suite because those pages need data before redirecting to
sign-in.

`pnpm test:vite:development` runs the same route checks through the Vite
development server proxy to Express, which fetches the shell from Vite. It
verifies module loading and injected styles from the Vite browser origin. Both
smoke commands run in CI. Dependency scanning treats legacy `.js` components
as JSX and injects the browser `process` shim into pre-bundled dependencies
such as `parse-link-header`.

`pnpm test:vite:rtl` checks the RTL asset plugin without a browser and includes
the source alias, package export, and `.js`-to-TypeScript import resolution
checks. Vite development does not emit the RTL stylesheet.

Local and CI end-to-end runs build the Vite client with `pnpm run build:e2e`.
Vite inlines assets up to 10 KB and writes source maps. Unminified stylesheets
contain the same site rules, including the Bootstrap theme in
`legacy-classes.less`. Production CSS is minified by Lightning CSS. The output
references five `/assets/images/` files and four `/assets/fonts/` files; the
Fontello SVG is emitted as a hashed file under `/assets/images/`.

The 14 October 2026 evaluation measured a Vite build at about 1.1 seconds, with
a 2.41 MiB script (706 KiB gzipped) and a 509 KiB stylesheet (124 KiB gzipped).
The earlier Webpack comparison measured 17.5 seconds, a 3.27 MiB script (879
KiB gzipped), and a 656 KiB stylesheet (141 KiB gzipped). Current development,
production, and end-to-end workflows use Vite.
