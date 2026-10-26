## Why

After feature-facing runtime interfaces are separated from shell composition, no production module needs to import a layer or app. The existing module graph only tracks links between feature modules, so it cannot prevent that upward coupling from returning. This is the next bounded guard slice for #3358.

## What Changes

- Reuse the shared-package guard's literal-import scanning and path resolution for a production module boundary check.
- Reject module imports into `layers/*` or `apps/*`, including aliases, workspace names, relative paths and file URLs. Keep feature-module dependencies under the existing graph/manifest checks and leave legacy root configuration imports for later extraction.
- Run module boundary regressions and checks in local lint, affected checks and CI, with no compatibility exception list.

## Impact

This PR is stacked after the shell/core ownership cleanup. It changes developer tooling only; application behaviour, module dependencies, deployment, client/server coverage gates and browser journeys are unchanged. Static temporary-repository fixtures test the rule directly, so additional browser journeys are not appropriate.
