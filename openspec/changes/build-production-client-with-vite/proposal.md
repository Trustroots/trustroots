# Build the production client with Vite

## Why

Development, the end-to-end client build, and the production-asset comparison
now use Vite. `pnpm build` is the remaining command that still produces the
client with Webpack, including the production image.

## What Changes

- `pnpm build` runs the Vite production build after the existing public-asset
  clean and circle-image generation.
- `pnpm build:webpack` remains available.
- Express continues to serve `react-main.js`, `react-main.css`, and
  `react-main.rtl.css`.

## Affected modules

- `package.json` production build script
- production image build, which calls `pnpm run build`

## Compatibility and deployment

No member-facing behaviour, stored data, or API changes. The next production
image build emits the Vite client instead of the Webpack client. No data
migration. Webpack stays installed until a following change removes it.
