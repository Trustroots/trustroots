## Why

Radio chat shows abbreviated hexadecimal author keys, omits the date and uses
station links that resolve against the document's root base URL.

## What Changes

- Display chat authors' npubs and link eligible linked accounts to their Trustroots profiles.
- Display chat timestamps with the date and 24-hour time in UTC.
- Keep station hashtag links on the Radio circle.

## Capabilities

### Modified Capabilities

- `radio-circle`: Show author identity, timestamps and station links in chat.

## Impact

The existing author visibility lookup can optionally return eligible profile
usernames to signed-in members. Its default response remains compatible.
