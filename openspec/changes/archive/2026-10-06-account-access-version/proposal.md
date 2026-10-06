## Why
Account access pages hide the site footer, making production version identification difficult during login incidents. Visitors may also use the familiar /login URL.

## What Changes
Show the existing deployed commit and date link in a compact footer on signin, signup, password recovery/reset and not-found pages. Redirect /login to /signin, preserving query parameters.

## Impact
Non-breaking account access presentation and a public route alias. No database or deployment configuration migration.
