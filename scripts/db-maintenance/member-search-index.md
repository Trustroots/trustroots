# Member search index update

The extended member search uses MongoDB's existing single text index. Its new fields are `locationLiving`, `locationFrom` and `tagline`, with names and usernames weighted above location and tagline matches. Biographies, email addresses, precise coordinates and private account fields are not indexed by this command.

Before deploying the extended search against an existing database, preview the targeted change:

```sh
NODE_ENV=production node scripts/db-maintenance/update-member-search-index.mjs
```

In an operator-selected maintenance window, run it with `--apply`. It reads the configured database connection and replaces only the users text index. Other indexes and profile documents are untouched. Member text search is temporarily unavailable while MongoDB builds the replacement; the index size and available database resources determine the duration. An already-current index is left alone. A fresh test database creates the new index normally.

```sh
NODE_ENV=production node scripts/db-maintenance/update-member-search-index.mjs --apply
```

The API accepts 3–120 characters, returns at most 50 results per request, bounds pagination to the first 1,050 results, and gives each query a two-second database execution budget. Relevance comes from the text index; field match labels on cards indicate literal matching text and may be absent for stemming matches.
