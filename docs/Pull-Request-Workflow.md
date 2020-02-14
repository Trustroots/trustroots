## Pull request workflow

- `master` is the most up-to-date, development branch.
- Start new branches directly at Trustroots repository and use descriptive names so that it's easy to keep track of them. E.g. `fix/profile-description` or `add/references-api`.
  - If you're not actively working on Trustroots yet, just fork the project and send pull requests from your repo. We will give you commit rights early on.
- When you have some code ready, feel free to open a Pull request (PR). At this point you don't have to be "done"; it's okay to open PR as early as possible and thus get early feedback.
- Ideally PRs are as small and focused as possible. That ensures that they are easy to review and quick to merge. If feature isn't ready yet, we can hide it behind a feature flag and keep it visible only for developers. You could for example PR a skeleton of a new API in one PR and work on the API in follow up PRs. Bigger the PR, slower and harder it is to review.
- Preferably PRs are _reviewed_ and _tested_ by someone. Because of lack of volunteer time, there are some more experienced folks with deeper understanding of the whole codebase, who might merge their PRs directly without reviews. This isn't ideal but acceptable in current volunteer situation.
  - Most experienced people with the codebase are @simison and @mrkvon (as of 2/2019).
- To make reviewing easier, write clearly what is the reasoning for the change and if possible, also testing instructions.
- Each commit in PR launches automated tests in Travis CI and results are reported in the PR. Make sure to keep tests from failing.
- Once PR is accepted, you can hit "Squash & merge" on GitHub yourself. Squashing is important so that the commit log stays easier to read and so that it's easier to revert changes if they cause regressions.
- Every now and then @simison merges `master` branch to `production` branch and deploys that branch to production server.

Folders where PR workflow can be relaxed, since application code isn't touched:

- bin/admin
- deploy
- docs
- scripts
