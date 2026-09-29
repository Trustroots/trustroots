## ADDED Requirements

### Requirement: Application commands do not depend on Gulp

The project SHALL start its server and worker and run server tests through npm scripts without requiring Gulp.

#### Scenario: Application startup

- **WHEN** a developer or deployment invokes an existing server or worker startup command
- **THEN** the process starts in the selected environment without loading Gulp

#### Scenario: Server test execution

- **WHEN** a developer invokes the server test command or its watch variant
- **THEN** database preparation, index creation, test execution, and cleanup occur without loading Gulp
