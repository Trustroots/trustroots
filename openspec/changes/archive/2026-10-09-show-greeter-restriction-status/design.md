## Approach

Read roles internally and project `restrictionStatuses`, containing only `suspended` and `shadowban`, on stories and restricted matches. Unrestricted accounts return an empty array. Render labelled danger badges beside each relevant name, independently of profile visibility. Missing fields render no badges for compatibility. Retain existing endpoint authorisation and profile restrictions.

## Validation

Cover both statuses, their combination, unrelated roles, authorised greeters and administrators, and denied ordinary-member access. Add greeter e2e coverage including denied role changes. Preserve existing coverage thresholds and e2e tests.
