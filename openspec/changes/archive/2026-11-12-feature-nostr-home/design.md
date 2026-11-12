## Decisions

- Resolve an event reference in the admin browser through a fixed set of public relays. Treat web links as event identifiers and disregard relay hints.
- Use the existing admin role policy for write endpoints. Verify the signed kind 1 event server-side and use the event ID as the unique storage key.
- Serve stored public note fields through a read-only endpoint. Render note content as text with a link to the original. Store a snapshot until an administrator removes it.
