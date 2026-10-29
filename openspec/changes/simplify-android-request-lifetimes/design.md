## Request-slot ownership

`LatestRequest` owns a `CoroutineScope` and its current `Job?`. `launch` creates
a lazy job, stores it in the slot, cancels the prior job, then starts the new
job. This order matters: cancellation callbacks may synchronously call back
into the slot, and the repository operation may synchronously trigger a newer
request before the original `launch` call returns. In either case, the newer
job replaces and cancels the pending older job. The original call's later
`start()` is harmless for a cancelled job.

`cancel` clears the slot before cancelling the captured job. This permits a
cancellation callback to install a new request without the outer cancel
clearing that newer request afterward.

Each slot is dedicated to one existing operation. Replacing a job cancels its
children through normal coroutine structured concurrency. The initial profile
load keeps its hosting, contacts, references and relationship requests as
children; the user-triggered reference refresh uses its own slot.

`requestResult` remains responsible for checking cancellation before and after an
operation returns, including operations that temporarily run in
`NonCancellable`. Request-slot ownership replaces only the parallel freshness
epochs and checks whose corresponding jobs are cancelled on supersession,
environment change, or ViewModel clearing. Do not remove session invalidation
latches: invalidating a session does not cancel every request, and the latches
continue to reject events or suppress duplicate invalidation delivery.
Polling loops whose lifecycle transitions cancel their owning slot can use an
unconditional loop with cancellation checkpoints before state publication and
before waiting. This removes duplicate lifecycle predicates while keeping the
same cancellation and polling cadence.

## Validation design

After the member-profile pilot passes its existing regression suite, apply the
same ownership rule to replaceable requests in account settings, profile
editing, experience creation, contacts, inbox, host detail, host offers,
host maps, member search, conversations, circles, circle detail and the member shell. Keep permanent state-flow
observers separate. Keep revisions that represent actual query or membership
changes independently of job cancellation; a request slot replaces only
freshness bookkeeping whose operation is superseded or cancelled.
Conversation history loading and sending may overlap. Keep their separate
request slots and preserve the merge of messages sent while history loads;
retry and environment changes retain their existing cancellation rules.

Test `LatestRequest` at its boundaries: the initial job runs, replacement
cancels the old job and starts the new one, late non-cancellable work cannot
pass `requestResult`, cancellation callbacks can re-enter and install a newer
request, and a repository operation that synchronously requests a replacement
cannot publish its old result. Keep the existing `MemberProfileViewModel`
tests for account refresh, entry clearing, cancellation, session invalidation,
and synchronous repository re-entry. Do not use reflection or test-only
production seams.
