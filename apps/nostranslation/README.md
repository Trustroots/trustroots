# Nostranslation

AI prepares translation drafts; Trustroots contributors proofread, correct or
improve them. Approved batches become draft PRs. Published translations remain
in `public/locales/`, and merged review metadata under `reviews/` supplies
language-specific examples for subsequent AI requests. This is prompt feedback,
not model training. Pending PRs and stale reviews are not accepted examples.

The frontend lives at **https://team.trustroots.org/nostranslation**. Both team
Pages deployment jobs bundle it under `/nostranslation/`; the existing team
site and reports remain available. API hosting is separate from GitHub Pages.

## Development

Use Node 24 and the repository's pinned pnpm version. From the repository root:

```sh
pnpm install
pnpm nostranslation:dev
pnpm nostranslation:typecheck
pnpm test:nostranslation --coverage
pnpm test:nostranslation:e2e
pnpm nostranslation:build
```

The development frontend is at `http://127.0.0.1:4311/nostranslation/`.
Set `VITE_NOSTRANSLATION_API_URL=http://127.0.0.1:4310` when starting Vite and
set `NOSTRANSLATION_PUBLIC_API_URL` to the same value on the API. Set
`NOSTRANSLATION_ORIGIN=http://127.0.0.1:4311` for local cross-origin requests.

## Service deployment

Build from the repository root with
`docker build -f apps/nostranslation/Dockerfile -t nostranslation .`.
Run one API instance behind an HTTPS reverse proxy with a persistent `/data`
volume and a read-only GitHub private-key mount. Back up the SQLite database
with its WAL through SQLite's backup mechanism, or stop the service before
copying the whole volume. The volume holds unpublished AI drafts, replay state
English source fingerprints and submission recovery records; it does not replace Git for published content.

| Variable                                | Purpose                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `NOSTRANSLATION_GITHUB_APP_ID`          | GitHub App ID                                                      |
| `NOSTRANSLATION_GITHUB_INSTALLATION_ID` | Installation on Trustroots/trustroots                              |
| `NOSTRANSLATION_GITHUB_KEY_FILE`        | Mounted PEM private-key path                                       |
| `NOSTRANSLATION_DATABASE`               | SQLite path; Docker defaults to `/data/nostranslation.sqlite`      |
| `NOSTRANSLATION_PUBLIC_API_URL`         | Canonical external API URL, without trailing slash                 |
| `NOSTRANSLATION_ORIGIN`                 | Allowed frontend origin; defaults to `https://team.trustroots.org` |
| `PORT`                                  | API port; defaults to `4310`                                       |
| `OPENAI_API_KEY`                        | Server-only generation credential                                  |
| `NOSTRANSLATION_MODEL`                  | Deployment-selected model supporting Responses structured output   |
| `NOSTRANSLATION_GENERATION_LIMIT`       | Maximum strings per run, 1–1000; defaults to 100                   |

Install the GitHub App on this repository only, granting Contents and Pull
requests read/write. Do not grant workflow or administration write access.
GitHub App PRs run ordinary CI. The service never merges or changes `main`.

Provision the API DNS/TLS and set the GitHub repository variable
`NOSTRANSLATION_API_URL` before publishing the frontend. Both build and API
default to `https://nostranslation-api.trustroots.org`; that hostname still
needs provisioning. Never put credentials in a `VITE_` variable.

With AI credentials configured, the API generates drafts at startup and an hour
after each completed run, detecting the latest English source from `main`.
Jobs are bounded and do not overlap. The first catalogue observation establishes
the baseline for existing English values; later changes queue renewed review. Without AI credentials, proofreading and
submission still work. For a one-off run use `pnpm nostranslation:generate`
with the same database and credentials while the automatic generator is stopped.
Watch stderr for failed runs, `/health` for process availability, and provider
usage for spend. The per-run string bound limits work, not monetary spend;
configure a provider project budget as well.

Generation uses the official Responses API with structured output, `store:false`
and strict local formatting validation. It sends public English strings,
language information and public accepted translation examples. It never sends
member records or credentials. See the [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

## Proofreading and corrections

- Proofread in a table comparing English source, published wording and your
  proposed translation, with status and review actions on each row. Headers stay
  visible while scrolling; on small screens scroll the table sideways to edit.
- Select a language and review the queue, or choose **All translations** to
  improve published wording. Editing clears approval. Drafts stay in this
  browser; clearing browser storage removes them. **Skip for now** hides a string
  until you refresh, keeping your typed correction without approving it.
- Review approved strings before sending up to 100 per PR. Sign through a
  NIP-07 browser extension or NIP-46 remote signer (QR/deep link or bunker URL).
- Use a key linked to an eligible public Trustroots profile. The public NIP-05
  endpoint excludes private, suspended and shadow-hidden profiles. Merely
  entering a username does not prove ownership: the signed key must match.
- The service requires a fresh NIP-98 signature bound to the exact request URL,
  method and body. Five batches per key per hour are allowed. Retry failures
  from the same saved draft; deterministic branches recover existing PRs.
- If English or the target string changes, refresh and proofread it again.
  Refresh preserves typed corrections and clears approval for stale entries.
- After merge, accepted corrections guide the next generated draft for that
  language, with recent corrections from the same section prioritised. This
  does not automatically rewrite other published human translations.

CI validates changed target strings, plural forms and review fingerprints on the
merged PR revision. Stale approvals must be reviewed again, leaving unrelated legacy
translation defects for separate fixes. The main app's existing JSON format,
language publication flags and fallback behaviour remain unchanged.

## Weblate cutover

Keep Weblate connected during deployment and acceptance. Before switching:

1. Generate a real draft, sign in with both supported signer flows and submit a
   human correction. Check attribution, feedback metadata and CI on its PR.
2. Merge through normal review, deploy Trustroots and confirm the translation
   is visible. Confirm the next generation request includes the accepted correction.
3. Reconcile outstanding Weblate contributions, then disable its sync/webhooks
   and revoke repository access. Do not discard outstanding translator work.
4. Replace the Weblate widget and contribution links with this app, remove its
   CSP allowance and test stubs, and rename the extraction formatter while
   preserving its required JSON-flattening behaviour.

These final steps need production acceptance and deployment access. This change
deliberately leaves Weblate and all existing translation content in place.
