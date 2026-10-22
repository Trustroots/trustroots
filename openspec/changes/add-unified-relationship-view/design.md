## Existing behaviour

| Source                      | Existing contract                                                                              | Consequence for the shared view                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `contacts.api.getByUserId`  | Contact record or `null` for HTTP 404; other failures reject                                   | Derive incoming/outgoing from participant IDs. A missing contact alone does not establish that actions are allowed. |
| `experiences.api.readMine`  | Viewer/other pair or `null`; primary record can belong to either author                        | Determine ownership from `userFrom`, including populated and string IDs; never assume primary means yours.          |
| Experience payload service  | Private primary details are omitted for non-authors; reciprocal response has a different shape | Preserve omissions. Do not infer text, interaction values or a response publication state from missing fields.      |
| `reference-thread.api.get`  | Latest viewer-authored answer, or 404 with `allowCreatingReference`                            | Preserve author-only reads and explicit eligibility; a route-level 404 does not grant permission.                   |
| `reference-thread.api.send` | Creates another feedback history record                                                        | Changing the answer uses the existing POST; no replacement or deletion of history.                                  |
| `Thread.component.tsx`      | `ReferenceThread` is inside the sidebar excluded on extra-small screens                        | Put a visible connection entry point outside that condition.                                                        |

## Shared ownership and loading

Keep `YourConnection` and a pure typed adapter under
`modules/contacts/client/`. The component accepts the authenticated viewer and
other member identities plus existing availability and feature configuration;
neither mounting surface implements its own relationship interpretation. Reuse
the current API clients and existing contact/Experience routes and removal flow.
Keep private data out of public profile responses and shared browser storage.

Key every read by both member IDs, clear data on pair or authenticated-user
changes, and ignore late results for the previous pair. Give each source an
explicit loading, ready, unavailable or error state; a failed read must not
become an empty account or an invitation to create a duplicate. Allow retry of
failed sections while keeping successfully loaded sections usable. Feature-off
sections make no API calls and expose no mutation controls.

The view model separates these concepts:

- Contact: absent, incoming, outgoing or confirmed, only after a successful read;
  preserve its identifier for existing actions.
- Your account: absent or existing, with an explicit author and the public or
  awaiting-publication state supported by the payload.
- Their account: absent, permitted metadata only, or permitted details; attach a
  publication label only when the payload supports it. A missing field is not a
  negative answer. Never borrow the primary record's visibility for its response.
- Message feedback: unanswered and eligible, answered, ineligible, disabled or
  failed; expose only the viewer's latest answer. Read errors do not grant
  eligibility. A changed answer becomes confirmed only after saving succeeds;
  preserve the previous answer and offer retry on failure.

Use the server's existing visibility filtering. Do not fetch administrative
endpoints or widen an API response to fill a hidden field. Identify the other
author of a reciprocal response only from the known pair and primary direction;
do not invent fields absent from the response contract.

## Presentation and actions

Use the same four labelled sections on both surfaces: **Connection**, **Your
account**, **Their account** and **Private message feedback**, under **Your
connection**. Explain that this section is private to the viewer; it can contain
already-public Experience information without making private information public.
Use named authors as well as relative labels where needed. Render separate
accounts even when they disagree.

The profile shows the section for an eligible signed-in viewer of another member.
The thread offers a labelled, keyboard-accessible disclosure near the member
header on all screen sizes. Its expanded contents must scroll without hiding
the composer or trapping focus. A responsive disclosure may differ in layout,
but must use the same component, data and available actions. Remove the old
standalone thread feedback placement once integrated to avoid duplicate controls.

| Contact status | Existing action destinations                         |
| -------------- | ---------------------------------------------------- |
| Absent         | Add-contact form                                     |
| Incoming       | Confirmation page; existing removal flow for decline |
| Outgoing       | Existing removal flow for cancelling the request     |
| Confirmed      | Existing removal flow for removing the contact       |

Availability, member restrictions and load success gate these actions. An API
404 may also represent a hidden or restricted member, so never use contact
absence as the only eligibility check. Preserve activation, self-profile,
blocking, suspension, shadow-hiding and removed-member behaviour. If a mutation
is rejected after a restriction changes, show the error and refresh state rather
than displaying success. Do not resolve #2536 by adding an unblock prerequisite
or a new exemption here.

Keep the Experience-writing action available for eligible pairs without a
confirmed contact, including pending and absent contacts. Existing-account
states link to the existing Experience flow rather than creating another record.
Show publication status from existing fields and reuse existing publication
explanations/constants where applicable. Opening this view or changing contacts
or message feedback must not create an Experience or start/reset its countdown.

Use **Not recorded** for missing meeting answers. For explicit recorded values,
distinguish yes/no without coercing missing values to false. Express hosting as,
for example, **You hosted this member** in your account and **This member hosted
you** in theirs; `host` and `guest` describe the respective author's role.

Before request submission and before acceptance, show plain guidance: **You can
message this member without adding them as a contact. Only send contact requests
to people you know, and only accept requests from people you know.** Keep messaging
subject to existing restrictions.
Contact acceptance confirms a connection; it does not assert a meeting or a
recommendation. Add translations through the existing extraction workflow.

## Delivery and verification

1. Review and strictly validate this proposal.
2. Implement the typed adapter and shared view with client tests, then integrate
   both surfaces and update contact guidance in the implementation PR.
3. Add server contract regressions for visibility/eligibility as needed without
   changing their rules. Add end-to-end coverage for consistency, feedback changes
   and mobile access. Preserve 100% client/server coverage and existing e2e tests.
4. Validate the completed change, archive the proposal and update the living
   specification only after implementation is complete.

No new e2e test is appropriate in this proposal-only PR because it changes no
application behaviour. Implementation tests are required in `tasks.md`.
