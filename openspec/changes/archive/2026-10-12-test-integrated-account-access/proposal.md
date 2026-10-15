# Exercise combined account access flows

## Why

Account access features should have a shared integration test matrix that exercises their combined behaviour across browser and native clients.

## What Changes

Add combined scenarios for member sessions, account action tokens, sign-in challenges and MFA. Exercise password recovery, email confirmation, revocation, concurrent requests and client capability handling against the same application build.

## Impact

Test fixtures, feature coverage registry, account-access browser/API scenarios and native client contracts. Depends on the four existing account-access PRs being integrated. Correct the session lifetime initialisation and native intermediate-response handling exercised by the new regressions, and require the test runner to use an explicit test environment and database.

## Delivery

Implement the combined regression matrix and the compatibility corrections together, then archive the proposal and retain the scenarios in the living account-access specification.

