## Design

The parent runner partitions selected test files across a configurable number of child Node processes. Each child uses the existing serial runner so index creation and suite lifecycle stay unchanged. A unique invocation token and worker index form database names beginning with `trustroots-test-worker-`. The test environment accepts only this restricted database-name shape for worker overrides. Parallel runs skip local configuration overrides to retain isolation. Agenda already uses the same configured MongoDB URI as Mongoose.

The parent waits for every child and returns failure if any fails. SIGINT and SIGTERM terminate child processes. The parent drops the planned worker databases after all children finish, including failed and interrupted runs. The existing serial command remains the default, and two workers are the conservative parallel default because each active scrypt derivation consumes roughly 128 MiB.

Coverage continues to use NYC's existing subprocess collection when the parallel command is run under the existing coverage preloader. Coverage thresholds and exclusions remain unchanged.

Keep startup checks that exercise fresh-process configuration. Database indexes are already prepared once per serial process. Session reuse must not conceal authentication checks or depend on sessions surviving fixture deletion; do not change it without a suitable measured case.
