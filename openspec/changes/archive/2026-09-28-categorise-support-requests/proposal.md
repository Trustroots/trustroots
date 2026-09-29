## Why

Issue #2890 asks for a clear next step for prospective volunteers and a way for
support to distinguish volunteer enquiries, account help, and member reports.

## What Changes

- Add Account help, Report a member, Volunteering, and Other support categories.
- Link the volunteering page to a short enquiry form with Volunteering selected.
- Preserve member-report links and prompt volunteers for interests, skills, and
  availability in the existing message field.
- Store the category and include its readable label in support emails.

## Capabilities

### Modified Capabilities

- `public-access`: Categorised support and volunteer enquiries for visitors and
  signed-in members.

## Impact

Affects the pages and support client modules, support model/controller, and
support email service/template. Older API clients remain supported: requests
with a reported member infer the reporting category; others default to Other.
Unknown submitted categories are rejected. Existing stored requests remain
readable without a data migration. No deployment configuration changes.
