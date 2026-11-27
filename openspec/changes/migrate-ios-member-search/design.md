# Design: Migrate iOS member search to Compose

The existing iOS API remains responsible for the authenticated search request
and circle catalogue. Add a narrow member-search gateway contract that accepts
query and serialisable filter values and returns safe search result values.
Swift adapts the current native API models to this contract.

Compose owns the query, active filters, last submitted filters, result list and
loading/error state. It calls the gateway on submit, retries with the same
query/filters, and refreshes after the filter sheet closes when values changed
after a successful search. The iOS host owns selected profile navigation and
retains the Compose controller while presenting a profile so returning restores
the same search state. Switching between the offer and member modes also keeps
the member search controller mounted.

The screen exposes stable accessibility identifiers and descriptive semantics
for the query field, filters, retry action and results. Shared unit tests cover
state transitions; the iOS fixture journey verifies mode switching, profile
round-trip, filter refresh and accessible controls. Runtime and physical-device
acceptance must be recorded separately and are not inferred from simulator
tests.
