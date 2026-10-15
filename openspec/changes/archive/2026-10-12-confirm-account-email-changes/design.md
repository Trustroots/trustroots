# Confirm account email changes

## Flow

1. A signed-in member submits a proposed email and their current password.
2. When MFA is enabled, the member also supplies an authenticator or recovery code; confirmation is bound to the member, session and current authentication version.
3. The server validates credentials and address availability, then stages the address and issues a dedicated confirmation token.
4. A confirmation message goes to the proposed address and a notification goes to the current address.
5. Confirming the current pending token atomically applies the address change. Cancelling or replacing the pending change invalidates earlier tokens.

## Policy

Credential confirmation is specific to the submitted change and is never a reusable general elevation flag. Do not accept a client-supplied confirmation timestamp. Return the same invalid-credential response for credential failures. Apply the existing request-limit and CSRF conventions to confirmation and cancellation endpoints.

The old-address notification identifies the action and time but contains no new address, reusable credential or direct account-mutating link. A delivery failure is retried through the existing email job system; it does not silently undo an already committed address change.

## Compatibility and rollout

The web account-settings form supplies the additional credentials. Native clients must be updated to send a current password and, for MFA-enabled accounts, a second-factor proof; the server rejects email changes from clients that omit those fields. Keep the current email as the recovery destination until confirmation completes. Do not automatically rename or migrate accounts.

## Validation

Cover correct and incorrect credentials, MFA/recovery-code consumption, stale authentication versions, pending replacement and cancellation, notification delivery, cross-member access and concurrent confirmation. Add an account-settings browser flow and verify existing email-change callers.
