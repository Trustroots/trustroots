# CI security and dependency ownership

Repository maintainers own review of CI workflows, dependency update pull requests, and the GitHub Actions secrets used by release and publishing jobs. Review workflow changes with the same care as application code because workflow changes can access repository credentials.

External GitHub Actions are pinned to full commit SHAs, with the upstream release version kept in a comment. Dependabot checks GitHub Actions and npm dependencies every Monday. It groups minor and patch updates to keep review manageable; major updates remain separate. A maintainer should confirm the release notes, compatibility, and updated SHA before merging an action update.

Keep `GITHUB_TOKEN` permissions limited to the job that needs them. Grant package write access only to the job that publishes the development image, and keep package consumers read-only. Grant release secrets only to the release step that uses them. Do not print secret values, pass them through command arguments, or expose them to pull requests from forks. If a secret appears in logs or is otherwise exposed, maintainers should revoke or rotate it and review the affected workflow run.
