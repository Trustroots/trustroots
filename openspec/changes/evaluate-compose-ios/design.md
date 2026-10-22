## Context

Both native apps have working member journeys and platform integrations.
The agreed destination is shared Kotlin logic and Compose UI, preserving the
stronger existing behaviour feature by feature. This PR adds an assessment only.

## Decisions

Keep the Android Gradle root and plan a shared library in `apps/shared`.
Embed Compose in the existing SwiftUI application with its current identity.
Compose owns navigation within migrated journeys; native hosts retain other
destinations. Use a shared design with useful platform-specific behaviour.

The first milestone uses real APIs for sign-in, profile, inbox, conversation
and reply. Reuse native secure storage through shared interfaces, with one
session across native and shared screens. Do not require another sign-in or
change credential formats. Defer new common offline work while preserving
existing caches and drafts through adapters.

Migrated iOS destinations become defaults after acceptance checks; no developer
toggle or separate app is planned. Keep native screens until replacements pass.
Preserve Android behaviour and notification routing.

Compare alternatives without arbitrary weights. Separate source evidence,
official support, estimates and unverified runtime claims. Resolve toolchain
compatibility in the first implementation stage rather than assuming current
Android pins are suitable for KMP.

## Verification and lifecycle

Validate this assessment and its links and run required repository checks.
Mobile builds and device checks are deferred. The later journey needs common
contract tests and native end-to-end journeys on both platforms using fictional
fixtures against a controlled test server.

Keep this change open while the broader evaluation is pending. Future PRs must
add and validate implementation requirements before coding. Update living specs
and archive when the corresponding migration gates are complete, not when this
documentation-only assessment lands.
