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
no migration scripts in that directory; old migrations that have already run
in production are in the git history.

The filename filter selects timestamped migration scripts and excludes this
README and `package.json` from the migration loader.

[See documentation](https://www.npmjs.com/package/migrate) for more.

### Database maintenance

You can drop your entire database by running:

```bash
pnpm run dropdb
```
