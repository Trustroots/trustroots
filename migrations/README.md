# Database migration scripts

Run migration scripts manually:

```bash
pnpm run migrate --matches '[0-9]*.js'
```

Revert migration scripts:

```bash
pnpm run migrate-down --matches '[0-9]*.js'
```

Create a new migration script:

```bash
pnpm exec migrate create migration-name-here
```

Run these commands from the repository root. Migration state is stored in
the `.migrate` file there by default.
Only migration scripts directly inside `migrations/` are run. When `.migrate`
is missing, all migration scripts in `migrations/` are run. There are currently
no migration scripts in that directory.

The filename filter selects timestamped migration scripts and excludes this
README and `package.json` from the migration loader.

[See documentation](https://www.npmjs.com/package/migrate) for more.

### Archived migrations

Older migrations, all of which have already run in production, used to live in
`migrations/archived/`. They were removed to keep the codebase lean and remain
available in git history. To restore them locally for reference:

```bash
git checkout 5ec71e146e7de5ed3a0b47b22a014a4ef9aebd9d -- migrations/archived
```

### Database maintenance

You can drop your entire database by running:

```bash
pnpm run dropdb
```
