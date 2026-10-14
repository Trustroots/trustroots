# Vite evaluation

`pnpm start` serves the React shell with Vite. Open <http://localhost:3000>.
Vite serves `/assets/*` and proxies other requests to Express on port 3001.
`pnpm start:webpack` still starts the Webpack development server. Opening
Express on port 3001 directly cannot load the Vite development assets; those
requests have to go through Vite. Set `PORT` for Vite's browser port and
`TRUSTROOTS_API_URL` for the Express target when using different ports. The
Vite server listens on the same host as Webpack.

Both builds share client aliases from `config/client/aliases.cjs` and the
main stylesheet from `config/client/styles/main.less`. ESLint resolves source
imports with the TypeScript resolver, independently of either bundler.

Vite uses Less 4 through its `less` peer dependency. The default Webpack
configuration explicitly uses `less-webpack`, pinned to the existing Less
3.13.1 compiler, so this prototype does not upgrade Webpack's stylesheet
compiler.
Vite enables legacy Less arithmetic so existing unparenthesised divisions
compile with the same behaviour as Less 3. Module styles are imported after
Bootstrap. Vite prepends `import.meta.glob` imports, so that glob lives in its
own module; otherwise Bootstrap's later focus rules override app styles of
equal specificity.

`pnpm build:vite` emits a single IIFE `public/assets/react-main.js`,
extracted `react-main.css`, and `react-main.rtl.css`. The RTL file is produced
with `rtlcss`, the same compiler Webpack's RTL plugin uses, and the client
loads it for right-to-left languages. Build Webpack's output first if comparing
both tools: Vite overwrites those entry files. It keeps other files in
`public/assets`. `pnpm build` runs that Vite build for production images.
`pnpm build:webpack` remains available.

After building Vite, run `pnpm test:vite:production`. This browser smoke test
uses Express's real production template and locals to load the bundle and CSS
on the public pages, including home, about, contact, contribute, the FAQ
sections, foundation, guide, media, rules, statistics, support, team, greeters,
volunteering, circles, privacy, safety, the password and email-confirmation
states, and sign-in. It also loads the RTL stylesheet with an Arabic language
cookie. It requires Playwright's Chromium browser
(`pnpm exec playwright install chromium`), already included in the development
container. It checks script execution and route rendering without a database.
Map, circle-detail, and signed-in routes stay in the end-to-end suite: those
pages mount their own data requirements before the sign-in redirect.

`pnpm test:vite:development` runs the same route checks through the actual Vite
development server proxy to Express. It verifies module loading and injected
styles from the Vite browser origin. Both smoke commands run in CI. Dependency
scanning treats legacy `.js` components as JSX and injects the browser
`process` shim into pre-bundled dependencies such as `parse-link-header`.

`pnpm test:vite:rtl` checks the RTL asset plugin without a browser. Vite
development does not emit the RTL stylesheet; Webpack does not either.

Local and CI end-to-end runs build this Vite client with `pnpm run build:e2e`.
Set `TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER=true` to use the Webpack development
server instead.

Vite inlines assets up to 10 KB and writes source maps, matching Webpack.
Unminified stylesheets contain the same site rules, including the Bootstrap
theme in `legacy-classes.less`. Production Vite CSS is smaller because
Lightning CSS minifies it, while Webpack leaves the stylesheet pretty-printed.
Both production stylesheets reference five `/assets/images/` files and four
`/assets/fonts/` files. Webpack also leaves one source path,
`/modules/core/fonts/fontello/font/tricons.svg`, which Vite emits as a hashed
file under `/assets/images/`. RTL output from both tools flips `margin-left`
rules to `margin-right`. Repeat the check with
`node scripts/vite/compare-css.mts` after copying each build aside, because
Vite overwrites `public/assets/react-main.css`.

Measured on 14 October 2026, with Webpack's ESLint plugin skipped, Vite built
in about 1.1 seconds: a 2.41 MiB script (706 KiB gzipped) and a 509 KiB
stylesheet (124 KiB gzipped). Webpack built in 17.5 seconds: a 3.27 MiB script
(879 KiB gzipped) and a 656 KiB stylesheet (141 KiB gzipped). CI end-to-end
tests build that Vite bundle and are green. `pnpm start` and `pnpm build` use
Vite. `pnpm build:webpack` and `pnpm start:webpack` remain available.
