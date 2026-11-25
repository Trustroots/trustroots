# Show MongoDB index and maintenance status

## Why

Administrators need to check which indexes exist on the connected database and whether the circle discovery indexes survived a restore.

## What Changes

- Add a read-only collection index inventory to MongoDB diagnostics.
- Check the circle discovery index definitions against the requirements used by the maintenance command and show the result for each index.
- Preserve the MongoDB upgrade context and Agenda diagnostics when index metadata is unavailable.

## Capabilities

### Modified Capabilities

- `admin-moderation`: MongoDB diagnostics show collection indexes and current index maintenance status.

## Impact

The administrator API reads index metadata. The existing maintenance command remains the way to create the indexes.
