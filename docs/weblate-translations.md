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

Repo fixes can be overwritten by the next Weblate sync if the strings are not also corrected in Weblate's database. Always verify at the Weblate source after landing fixes in GitHub.

## Completed (repo)

Merged in [#2746](https://github.com/Trustroots/trustroots/pull/2746) (June 2026), which superseded closed #2711:

- Weblate translation batch (58 locale files: Tamil, Esperanto, Czech, Spanish, Finnish, and others)
- Placeholder fixes: `{{var}}}` typos that leaked a literal `}` in the UI (ta, pt, pt_BR, it)
- Markup fixes: broken React Trans tags in he, es, cs, it, ta
- QA tooling: [bin/check-i18n-placeholders.js](../bin/check-i18n-placeholders.js), `npm run i18n:check-placeholders`

## Open follow-up (Weblate / maintainers)

Track progress in [#2747](https://github.com/Trustroots/trustroots/issues/2747).

### 1. Confirm Weblate synced from `main`

- [ ] Weblate pulled upstream (auto via webhook/schedule, or manual: **Manage → Repository maintenance → Update**)
- [ ] Verified the strings in the table below no longer contain `{{var}}}` typos in the Weblate UI

### 2. Fix strings in Weblate if sync did not apply

If repo fixes did not propagate, edit at the source:

1. Create an account at https://hosted.weblate.org
2. Request translate rights from a Trustroots maintainer
3. Open the component + language (links below) and search for the source string
4. Edit the translation so placeholders match the English source exactly (`{{count}}`, not `{{count}}}`)
5. Save

| Component   | Language           | Source key fragment                                                    | Weblate link                                                                     |
| ----------- | ------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| experiences | Tamil              | Your experience will become public in {{count}} days                   | [experiences/ta](https://hosted.weblate.org/projects/trustroots/experiences/ta/) |
| contacts    | Tamil              | {{count}} contacts in common                                           | [contacts/ta](https://hosted.weblate.org/projects/trustroots/contacts/ta/)       |
| users       | Portuguese (pt)    | Replies within {{replyTime, fromNow}} / Open user profile for {{name}} | [users/pt](https://hosted.weblate.org/projects/trustroots/users/pt/)             |
| users       | Portuguese (pt_BR) | Replies within {{replyTime, fromNow}} / Open user profile for {{name}} | [users/pt_BR](https://hosted.weblate.org/projects/trustroots/users/pt_BR/)       |
| pages       | Italian            | Launched {{date, LL}}                                                  | [pages/it](https://hosted.weblate.org/projects/trustroots/pages/it/)             |

### 3. Enable placeholder quality checks (component admin)

- [ ] Open each component: **Settings → Checks**
- [ ] Ensure **Placeholders** / i18next interpolation checks are enabled
- [ ] Optionally add the placeholder check to **Enforced checks** so broken placeholders cannot be saved
- [ ] Review existing failures under each component's **Failing checks** list

### 4. Optional broader cleanup

`npm run i18n:check-placeholders` may still report pre-existing issues in other locales (e.g. Hebrew pages missing `<2>` tags, German plural keys). These were out of scope for #2746 but worth a separate pass.

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
