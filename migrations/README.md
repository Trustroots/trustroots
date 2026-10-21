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
Only migration scripts directly inside `migrations/` are run; scripts in
`migrations/archived/` are retained for reference and are not run automatically.
When `.migrate` is missing, all active migration scripts in `migrations/` are
run. There are currently no active migration scripts in that directory, so a
new installation does not replay the archived migrations.

The filename filter selects timestamped migration scripts and excludes this
README, `package.json`, and the archive directory from the migration loader.

[See documentation](https://www.npmjs.com/package/migrate) for more.

### Database maintenance

You can drop your entire database by running:

```bash
pnpm run dropdb
```
