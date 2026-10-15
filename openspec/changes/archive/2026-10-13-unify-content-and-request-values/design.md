# Design

Keep the server's existing text formatter, including automatic link creation. Move its allow-lists to a shared module. Use DOMPurify at browser insertion points with those same allow-lists; keep message link presentation inside this final formatting step. A single React component owns display HTML insertion. The editor uses the same formatter for initial and externally replaced content without rewriting the DOM during typing.

Contact and thread-reference constructors accept explicit operation fields. Existing model defaults assign identifiers and creation times. The existing request-key validator continues to run before API handlers; HTTP tests exercise nested query parsing and CSRF handling together.

Tests use fictional content and accounts. Validate retained formatting, expanded descriptions, message previews, editor replacements, request rejection before handler execution, and server-owned relationship fields.
