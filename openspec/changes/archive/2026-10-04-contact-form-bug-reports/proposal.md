# Route bug reports through support

## Why

Members should be able to report bugs directly to Trustroots without creating
a GitHub account or issue.

## What Changes

- Add Report a bug as a support category, retaining it in storage and email.
- Route the menu and support-page bug links to the preselected contact form.
- Make contacting support the primary FAQ instruction and retain GitHub as an
  optional route, removing the issue-search and account-registration guidance.

## Impact

Support accepts the additive `reportBug` category. Existing categories and
member-report precedence remain unchanged. No migration is required.
