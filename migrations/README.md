# Migration scripts

These scripts are always run on `npm update`.

Run migration scripts manually:

```bash
npx npm run migrate
```

Create new migration scripts:

```bash
npx migrate create migration-name-here
```

State of your locally run migrations is stored at `.migrate` file in this folder.
On new installations the file is missing, **so all the migrations are run.**

[See documentation](https://www.npmjs.com/package/migrate) for more.
