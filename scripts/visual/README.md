# Visual check

A pixel-diff harness for UI refactors that should not change how the app
looks. It compares a base checkout (usually `origin/main`) with a head
checkout (your branch), with no tolerance: any differing channel in any pixel
counts.

It runs two suites:

- **components**: every fixture in `components/fixtures/`, in each interaction
  state. A fixture has a `before` render (the markup the app uses on the base
  branch, for example raw Bootstrap classes) and an `after` render (its
  replacement). `before` is shown with the base checkout's production
  stylesheet, `after` with the head checkout's.
- **app**: every route in `modules/core/shared/react-route-ownership.mts`,
  filled in with seeded parameters, plus the open states in `app/routes.mts`
  (hover and keyboard focus, loading, error alerts). Both checkouts are served
  by `start:e2e:api` from one seeded MongoDB, so they read the same data.

Each suite runs at 1280×800 and at 390×844 with touch (no hover media
feature), in LTR and in Arabic RTL. Every comparison also diffs the computed
styles of every element and its `::before` and `::after`.

## Running it

Make a second worktree for the base, install it, and run the harness from the
head checkout. Builds, Docker and Playwright make this a heavy command.

```sh
git worktree add --detach .claude/worktrees/visual-base origin/main
(cd .claude/worktrees/visual-base && pnpm install --frozen-lockfile)
node scripts/visual/run.mts --base .claude/worktrees/visual-base --out tmp/visual/run
```

| Option | Meaning |
| --- | --- |
| `--base DIR` | Base checkout. Required. |
| `--head DIR` | Head checkout. Defaults to the current directory. |
| `--out DIR` | Output directory. Required. |
| `--suite components,app` | Which suites to run. Defaults to both. |
| `--skip-build` | Reuse each checkout's existing `public/assets` build. |
| `--only REGEX` | Only comparisons whose key matches, e.g. `app/member__search`. |
| `--retries N` | Repeat renders for differing comparisons. Defaults to 4. |
| `--workers N` | Parallel app comparisons. Defaults to 3. |

The app suite starts a `mongo:4.4` container on a free port and removes it
afterwards.

## Reading the results

`OUT/index.html` lists every comparison that is not identical, with before,
after and diff images (cropped to the changed area for app pages) and the
computed-style differences. `OUT/results.json` holds the same data.

| Result | Meaning |
| --- | --- |
| 🟢 identical | Same pixels, same computed styles. |
| 🔵 styles only | Same pixels; computed styles differ. Check that nothing visible depends on them, for example in another state. |
| ⚪ noise | Differs, but a repeat head render was byte-identical to a base render. Typical sources: raster antialiasing, photo decoding, live admin data. |
| 🔴 different | Differs on every repeat. Explain each one or fix it. |
| 🟠 error | The capture failed; the message says why. |

The run exits 1 when anything is `different` or `error`.

## What is frozen

The clock (30 October 2026, 16:00 UTC), `Math.random` (seeded), transitions,
animations and the caret. WebGL is off, so maps use the Leaflet raster
fallback, and external images become a 1×1 pixel. Other external requests are
aborted. API writes are answered with `{}` so one side cannot change the data
the other reads. The footer's build stamp is replaced, because it names the
branch.

## Adding fixtures

Add a file to `components/fixtures/`, export a `Fixture[]` (see
`components/fixture.ts`) and list it in `components/fixtures/index.ts`. Give
interactive fixtures `states: ['rest', 'hover', 'focus-visible', 'active']`
and a `target` selector if the first button or link is not the one to use.
Fixtures cannot use `tw:` classes of their own: Tailwind only scans the app
and `packages/ui`, so style through the components.
