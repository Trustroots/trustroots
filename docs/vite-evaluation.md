# Vite evaluation

Webpack remains the supported build. Vite is an opt-in React shell prototype.

Run `npm run start:vite`, then open <http://localhost:3000>. Vite serves
`/assets/*` and proxies other requests to Express on port 3001. Opening Express
on port 3001 directly with `TRUSTROOTS_VITE_DEV_SERVER=true` cannot load those
development assets. Set `PORT` for Vite's browser port and
`TRUSTROOTS_API_URL` for the Express target when using different ports.

Vite uses Less 4 through its `less` peer dependency. The default Webpack
configuration explicitly uses `less-webpack`, pinned to the existing Less
3.13.1 compiler, so this prototype does not upgrade Webpack's stylesheet
compiler.

`npm run build:vite` emits a single IIFE `public/assets/react-main.js` and
extracted `react-main.css`, matching Express's production classic script tag
and asset filenames. Build Webpack's output first if comparing both tools:
Vite overwrites those two entry files. It keeps other files in `public/assets`.
Production deployment still runs the existing Webpack build.

After building Vite, run `npm run test:vite:production`. This browser smoke test
uses Express's real production template and locals to load the bundle and CSS
on sign-in, password recovery, and safety routes. It requires Playwright's
Chromium browser (`npx playwright install chromium`), already included in the
development container. It checks script execution and route rendering without
a database; full API and member workflows remain separate end-to-end checks.

CSS and RTL parity, hybrid route smoke tests, and build measurements remain
required before proposing a default switch. Vite does not yet generate the
Webpack RTL stylesheet.
