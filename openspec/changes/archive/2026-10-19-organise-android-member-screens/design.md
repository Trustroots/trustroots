## Decisions

Use `ui/membersearch`, `ui/profile`, `ui/editprofile`, `ui/inbox`,
`ui/conversation` and `ui/contacts` for the six existing screen entry points.
Kotlin package declarations follow their directories. Keep the profile action
bar and section components beside the profile screen, and extract language
labels and message timestamps into `ui/common` because multiple screens use
them. Move shared artwork, form navigation, insets and failure helpers there
as well, updating their existing consumers.

Keep function names, arguments, composable bodies and state lifetimes unchanged.
Only declarations that must cross a file boundary become `internal`; avoid
forwarding wrappers in the old package. Tests keep their existing packages and
import the new entry points, so their fixtures and assertions remain unchanged.

The app shell and unrelated screens remain in their existing files for this
focused change. Their later organisation and ViewModel extraction can follow
without coupling that review to this mechanical split.

## Validation

Compile production, unit-test and instrumentation-test sources; run Android unit
tests, lint and the debug build. Run the existing affected UI journeys against an
API 36 emulator, including profile entry from search, contacts and conversations,
toolbar/system Back, form discard protection, language labels, message drafts and
inbox filtering. Retain all existing tests and coverage thresholds. Run the
repository check before committing, and validate/archive this proposal after
implementation.
