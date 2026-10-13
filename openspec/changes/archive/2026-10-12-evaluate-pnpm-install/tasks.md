- [x] Generate a candidate pnpm lockfile on demand from the committed npm lockfile.
- [x] Add a repeatable local cold and warm install benchmark.
- [x] Document the production and development container checks needed before a switch.
- [x] Run and record the first install attempts on the supported Node.js 24 runtime.
- [x] Probe local canvas and sharp functionality with exact-version snapshot build approvals for both managers.
- [x] Document remaining build-approval, container and compatibility experiments as follow-up gates in #2796 before any separate migration proposal.

This change delivers the harness and diagnostic reports. The remaining
evaluation experiments are tracked in `docs/package-manager-evaluation.md`
and #2796; they have not been completed by this change.
