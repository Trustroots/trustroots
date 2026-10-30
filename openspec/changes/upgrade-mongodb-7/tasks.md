## Implementation

- [ ] 1. Confirm candidate driver and peer dependency compatibility for Mongoose,
      Agenda, `@agendajs/mongo-backend`, Agendash and connect-mongo; record the
      final resolved dependency graph without incompatible overrides.
- [ ] 2. Upgrade Agenda's backend and dashboard APIs, preserve `agendaJobs`, and
      update dependency manifests and lockfile.
- [ ] 3. Update the MongoDB server requirement, CI/test images and deployment
      configuration to MongoDB 7.0; retain or remove older-version coverage
      according to the migration support plan.
- [ ] 4. Run application, worker, session-store, Agenda, Agendash and full test
      acceptance on MongoDB 7.0; capture `pnpm why mongodb` evidence.
- [x] 5. Document recovery rehearsal requirements and evidence fields in
      `docs/mongodb-7-migration-runbook.md` (the rehearsal itself remains open).
- [ ] 6. Rehearse restore from a consistent backup including all job collections
      and record the results in the runbook.
- [ ] 7. Obtain operational approval separately, then execute the staged
      4.4 → 5.0 → 6.0 → 7.0 migration with a completed runbook record.
- [ ] 8. Archive this proposal and update the living `database-platform` spec
      after implementation and operational acceptance are complete.
