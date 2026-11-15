## Why

Android members need the same option as web members to explain why they are joining a circle.

## What Changes

- Add an optional join-reason field to native circle detail.
- Submit a reason only if the member enters one.

## Capabilities

### Modified Capabilities

- `circles`: Support optional reasons when joining from Android circle detail.

## Impact

The Android UI and membership request change. The existing membership endpoint handles storing the reason.
