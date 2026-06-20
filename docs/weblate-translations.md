# Weblate translations

Trustroots translations are managed on [Hosted Weblate](https://hosted.weblate.org/projects/trustroots/translation/).

## Flow

```
source code (modules/**/*.js)
  → npm run i18n:extract
  → public/locales/en/*.json
  → npm run i18n:fix-weblate
  → Weblate (translators edit)
  → auto-sync PR to GitHub
  → main
```

## After merging translation PRs

Weblate tracks this GitHub repo. After a fix lands in `main`:

1. Weblate should pull upstream on its next repository update (webhook or scheduled).
2. If strings do not update, a maintainer with repo access: **Manage → Repository maintenance → Update**.
3. Verify the corrected strings no longer contain typos (e.g. `{{count}}}` with an extra `}`).

## Fixing broken placeholders in Weblate

If repo fixes get overwritten by the next Weblate sync, correct the strings at the source:

1. Create an account at https://hosted.weblate.org
2. Request translate rights from a Trustroots maintainer
3. Open the component + language and search for the source string
4. Edit the translation so placeholders match the English source exactly (`{{count}}`, not `{{count}}}`)
5. Save

Known strings to verify after the 2026 placeholder fix batch:

| Component   | Language               | Source key fragment                                                    |
| ----------- | ---------------------- | ---------------------------------------------------------------------- |
| experiences | Tamil                  | Your experience will become public in {{count}} days                   |
| contacts    | Tamil                  | {{count}} contacts in common                                           |
| users       | Portuguese (pt, pt_BR) | Replies within {{replyTime, fromNow}} / Open user profile for {{name}} |
| pages       | Italian                | Launched {{date, LL}}                                                  |

## Quality checks (maintainers)

Prevent recurrence by enabling Weblate placeholder checks:

1. Open each component: **Settings → Checks**
2. Ensure **Placeholders** / i18next interpolation checks are enabled
3. Optionally add the placeholder check to **Enforced checks** so broken placeholders cannot be saved
4. Review existing failures under the component's **Failing checks** list

## Local QA

Scan all non-English locales for placeholder/tag mismatches vs English:

```bash
npm run i18n:check-placeholders
```

Scan specific locales only:

```bash
node bin/check-i18n-placeholders.js ta pt pt_BR it
```

Exit code 1 means issues were found.
