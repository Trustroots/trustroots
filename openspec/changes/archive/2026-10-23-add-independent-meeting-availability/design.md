## Context

The host offer already persists location when hosting is unavailable. Meet offers receive an expiry of at most 30 days and have a separate editor and location. Making those offers perpetual would require linking and synchronising two offers merely to share one location.

## Decisions

Store a boolean `happyToMeet` on the non-expiring host offer. Use the existing create/update API and schema validation; only explicit true opts in. Reuse its locationFuzzy and visibility restrictions. No profile-text inference or migration.

Search presents one marker per stored offer. A host with both states appears as a host in combined search and as a meeting marker in meeting-only search. Non-hosts who opt in appear only as meeting markers. A projection before existing status/type filtering supplies this discovery representation without changing stored hosting status. Read endpoints continue to expose actual states, so result cards and profiles show hosting and Happy to meet together. Dated meetups retain their current markers, locations and expiry.

Expose independent Hosts and Meetings filters, keeping at least one selected. Preserve explicit host-only filters in local storage. Location remains editable for every hosting status, without a hosting-description gate. Visibility explanation reflects both states and clarifies that circle restrictions apply to both.

## Risks

Search projections must run before the existing status filter and must never promote an opted-out non-host. Regression coverage must exercise host-only, meeting-only, combined, disabled, circle-only, non-public and fuzzy-location behaviour.
