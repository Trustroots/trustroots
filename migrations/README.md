# Database migration scripts

Run migration scripts manually:

```bash
pnpm run migrate
```

Revert migration scripts:

```bash
pnpm run migrate-down
```

Create a new migration script:

```bash
pnpm exec migrate create migration-name-here
```

State of your locally run migrations is stored at `.migrate` file in this folder.
On new installations the file is missing, **so all the migrations are run.**

[See documentation](https://www.npmjs.com/package/migrate) for more.

### Database maintenance

You can drop your entire database by running:

```bash
pnpm run dropdb
```
