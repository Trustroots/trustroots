## Design

Add a dedicated `ConversationRecipient` DTO with a non-null ID, optional username
and display name. Construct it only after the existing mini-user parser has
validated the canonical ID. Keep `MessageMember` for sparse inbox, host and block
records; their nullable fields remain meaningful.

Conversation repository results and immutable state use the new DTO. Sending,
avatar lookup and draft keys consume its canonical ID directly. An unresolved
recipient remains nullable in state and continues to disable those actions.
Share label resolution through one formatter rather than constructing temporary
generic DTOs. Preserve API failure types and all current payload validation.

## Validation

Keep mini-user missing/blank-ID regression cases, optional-username and malformed
JSON cases. Preserve draft-key precedence and all concurrent send/load/session
invalidation tests. Run the JVM suite, Android lint and focused device journeys.
