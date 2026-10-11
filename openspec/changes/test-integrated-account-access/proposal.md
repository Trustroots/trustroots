# Exercise combined account access flows

## Why

Account access features should have a shared integration test matrix that exercises their combined behaviour across browser and native clients.

## What Changes

Add combined scenarios for member sessions, account action tokens, sign-in challenges and MFA. Exercise password recovery, email confirmation, revocation, concurrent requests and client capability handling against the same application build.

## Impact

Test fixtures, feature coverage registry, account-access browser/API scenarios and CI grouping. Depends on the four existing account-access PRs being integrated; does not merge copies of their implementations into this proposal. Production behaviour remains unchanged.

## Delivery

This is a proposal-only change. Runtime implementation, migrations and deployment are separate follow-up work after the design is reviewed. The proposal remains unarchived until implementation is complete.

