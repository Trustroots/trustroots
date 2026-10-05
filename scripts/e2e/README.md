# End-to-end tests

`npm run test:e2e` runs the full suite. For a focused run, select one group:

```sh
TRUSTROOTS_E2E_GROUP=account-public npm run test:e2e
TRUSTROOTS_E2E_GROUP=community npm run test:e2e
TRUSTROOTS_E2E_GROUP=admin-search npm run test:e2e
```

CI runs these groups on three separate runners with independent apps and MongoDB
instances. Each uses two workers and serialises its projects to protect shared
seeded state. Group runs intentionally allow partial feature coverage; the final
`e2e` job combines their raw reports and requires complete feature coverage.
Missing, malformed or failed group reports fail that check. Reports and failure
artefacts have separate names for each group; the combined HTML index links to
all three reports.

Do not run groups concurrently in the same checkout: authentication files,
reports, application ports and the test database would collide. Separate local
checkouts also need distinct app ports and database endpoints.

The wheel tests retain every renderer, browser, input-unit and starting-zoom
combination. Each checks zoom in and out. The leave-and-return navigation sequence
runs once per renderer/browser using pixel wheel input at zoom 6, rather than
repeating it for every combination.
