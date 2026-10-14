# Vite evaluation

Webpack remains the supported build. Vite is an opt-in React shell prototype.

Run `pnpm start:vite`, then open <http://localhost:3000>. Vite serves
`/assets/*` and proxies other requests to Express on port 3001. Opening Express
on port 3001 directly with `TRUSTROOTS_VITE_DEV_SERVER=true` cannot load those
development assets. Set `PORT` for Vite's browser port and
`TRUSTROOTS_API_URL` for the Express target when using different ports.

Vite uses Less 4 through its `less` peer dependency. The default Webpack
configuration explicitly uses `less-webpack`, pinned to the existing Less
3.13.1 compiler, so this prototype does not upgrade Webpack's stylesheet
compiler.
Vite enables legacy Less arithmetic so existing unparenthesised divisions
compile with the same behaviour as Less 3.

`pnpm build:vite` emits a single IIFE `public/assets/react-main.js`,
extracted `react-main.css`, and `react-main.rtl.css`. The RTL file is produced
with `rtlcss`, the same compiler Webpack's RTL plugin uses, and the client
loads it for right-to-left languages. Build Webpack's output first if comparing
both tools: Vite overwrites those entry files. It keeps other files in
`public/assets`. Production deployment still runs the existing Webpack build.

After building Vite, run `pnpm test:vite:production`. This browser smoke test
uses Express's real production template and locals to load the bundle and CSS
on sign-in, sign-up, password recovery, safety, FAQ, support, circles, privacy,
and team routes. It also loads the RTL stylesheet with an Arabic language
cookie. It requires Playwright's Chromium browser
(`pnpm exec playwright install chromium`), already included in the development
container. It checks script execution and route rendering without a database;
full API, map, and signed-in workflows remain separate end-to-end checks.

`pnpm test:vite:development` runs the same route checks through the actual Vite
development server proxy to Express. It verifies module loading and injected
styles from the Vite browser origin. Both smoke commands run in CI. Dependency
scanning treats legacy `.js` components as JSX and injects the browser
`process` shim into pre-bundled dependencies such as `parse-link-header`.

`pnpm test:vite:rtl` checks the RTL asset plugin without a browser. Stylesheet
parity beyond the shared Less entry, and build measurements, remain required
before proposing a default switch. Vite development does not emit the RTL
stylesheet; Webpack does not either.
