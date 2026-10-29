package org.trustroots.android.ui.circledetail

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.circles.CircleRepository

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CircleDetailBranchContractsTest {
    @Test
    fun retryingTheMembershipSnapshotWhileMutationIsPendingKeepsTheMutationAlive() = withRepository { repository, scope ->
        val pendingUpdate = CompletableDeferred<Result<Unit>>()
        repository.updateHandler = { withContext(NonCancellable) { pendingUpdate.await() } }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertTrue(viewModel.state.value.isUpdating)
        viewModel.onEvent(CircleDetailEvent.RetryLoad)

        assertTrue(viewModel.state.value.isUpdating)
        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)
        pendingUpdate.complete(Result.success(Unit))

        assertTrue(viewModel.state.value.isMember)
        assertFalse(viewModel.state.value.isUpdating)
        assertEquals(1, repository.membershipChanges.size)
    }

    @Test
    fun mutationCompletingDuringRetriedCircleReadStopsTheStaleMembershipSnapshot() = withRepository { repository, scope ->
        repository.membershipSet = setOf("quiet-id")
        val pendingUpdate = CompletableDeferred<Result<Unit>>()
        val pendingCircle = CompletableDeferred<Result<TrustrootsCircle>>()
        repository.updateHandler = { withContext(NonCancellable) { pendingUpdate.await() } }
        repository.circleHandler = { call ->
            if (call == 2) withContext(NonCancellable) { pendingCircle.await() }
            else Result.success(circle())
        }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        viewModel.onEvent(CircleDetailEvent.RetryLoad)
        pendingUpdate.complete(Result.success(Unit))
        pendingCircle.complete(Result.success(circle().copy(label = "Stale circle snapshot")))

        assertEquals("Quiet Circle", viewModel.state.value.circle?.label)
        assertEquals(1, repository.membershipReads)
        assertFalse(viewModel.state.value.membershipsLoaded)
    }

    @Test
    fun mutationCompletingDuringRetriedMembershipReadStopsStaleMembershipPublication() = withRepository { repository, scope ->
        repository.membershipSet = setOf("quiet-id")
        val pendingUpdate = CompletableDeferred<Result<Unit>>()
        val pendingMemberships = CompletableDeferred<Result<Set<String>>>()
        repository.updateHandler = { withContext(NonCancellable) { pendingUpdate.await() } }
        repository.membershipsHandler = { call ->
            if (call == 2) withContext(NonCancellable) { pendingMemberships.await() }
            else Result.success(repository.membershipSet)
        }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)
        val initialGroupReads = repository.memberGroupSlugs.toList()

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        viewModel.onEvent(CircleDetailEvent.RetryLoad)
        pendingUpdate.complete(Result.success(Unit))
        pendingMemberships.complete(Result.success(setOf("quiet-id")))

        assertFalse(viewModel.state.value.membershipsLoaded)
        assertFalse(viewModel.state.value.isMember)
        assertEquals(initialGroupReads, repository.memberGroupSlugs)
    }

    @Test
    fun toggleBeforeMembershipsResolveDoesNotSubmitAnUpdate() = withRepository { repository, scope ->
        val pendingMemberships = CompletableDeferred<Result<Set<String>>>()
        repository.membershipsHandler = { _ -> withContext(NonCancellable) { pendingMemberships.await() } }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        assertEquals("quiet-id", viewModel.state.value.circle?.id)
        assertFalse(viewModel.state.value.membershipsLoaded)
        viewModel.onEvent(CircleDetailEvent.ToggleMembership)

        assertTrue(repository.membershipChanges.isEmpty())
        assertFalse(viewModel.state.value.isUpdating)
        assertTrue(viewModel.state.value.isLoading)

        pendingMemberships.complete(Result.success(emptySet()))
        assertTrue(viewModel.state.value.membershipsLoaded)
        assertFalse(viewModel.state.value.isMember)
        assertTrue(repository.membershipChanges.isEmpty())
    }

    @Test
    fun repeatedToggleWhileUpdateIsPendingSubmitsOnlyOneMembershipChange() = withRepository { repository, scope ->
        val pendingUpdate = CompletableDeferred<Result<Unit>>()
        repository.updateHandler = { withContext(NonCancellable) { pendingUpdate.await() } }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertTrue(viewModel.state.value.isUpdating)
        viewModel.onEvent(CircleDetailEvent.ToggleMembership)

        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)
        assertTrue(viewModel.state.value.isUpdating)
        assertFalse(viewModel.state.value.isMember)

        pendingUpdate.complete(Result.success(Unit))

        assertTrue(viewModel.state.value.isMember)
        assertFalse(viewModel.state.value.isUpdating)
        assertEquals(1, repository.membershipChanges.size)
        val event = requireNotNull(viewModel.state.value.pendingOverviewMembershipEvent)
        assertEquals("quiet-id", event.circleID)
        assertTrue(event.isMember)
    }

    @Test
    fun acknowledgingSessionInvalidationDoesNotAllowAnotherMembershipUpdate() = withRepository { repository, scope ->
        repository.updateHandler = { Result.failure(MobileApiException(401, "Fictional session expired.")) }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)

        val invalidation = requireNotNull(viewModel.state.value.pendingSessionInvalidation)
        assertFalse(viewModel.state.value.isUpdating)
        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)

        viewModel.onEvent(CircleDetailEvent.SessionInvalidationDelivered(invalidation.id))
        repository.updateHandler = { Result.success(Unit) }
        viewModel.onEvent(CircleDetailEvent.ToggleMembership)

        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertFalse(viewModel.state.value.isMember)
        assertFalse(viewModel.state.value.isUpdating)
        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)
    }

    @Test
    fun joinedMemberGroupsFromPreviousEnvironmentCannotReplaceCurrentGroups() = withRepository { repository, scope ->
        val staleGroups = CompletableDeferred<Result<CircleMemberGroups>>()
        val currentGroups = groups("current-otter", "Current Otter")
        repository.memberGroupsHandler = { call, _ ->
            if (call == 1) withContext(NonCancellable) { staleGroups.await() }
            else Result.success(currentGroups)
        }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertTrue(viewModel.state.value.isMember)
        assertTrue(viewModel.state.value.isLoadingMembers)
        assertEquals(1, repository.memberGroupSlugs.size)

        repository.membershipSet = setOf("quiet-id")
        viewModel.updateEnvironment(api("https://other.example.test"), session("rotated-cookie"))
        assertEquals(currentGroups, viewModel.state.value.memberGroups)
        assertFalse(viewModel.state.value.isLoadingMembers)
        assertNull(viewModel.state.value.pendingOverviewMembershipEvent)

        staleGroups.complete(Result.success(groups("stale-fox", "Stale Fox")))

        assertEquals(currentGroups, viewModel.state.value.memberGroups)
        assertFalse(viewModel.state.value.isLoadingMembers)
        assertNull(viewModel.state.value.failure)
        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)
    }

    private fun withRepository(test: (BranchRepository, CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            test(BranchRepository(), scope)
        } finally {
            scope.cancel()
        }
    }

    private class BranchRepository : CircleRepository {
        val membershipChanges = mutableListOf<Pair<String, Boolean>>()
        val memberGroupSlugs = mutableListOf<String>()
        var circleHandler: suspend (Int) -> Result<TrustrootsCircle> = { Result.success(circle()) }
        var circleReads = 0
        var membershipReads = 0
        var membershipsHandler: suspend (Int) -> Result<Set<String>> = { Result.success(membershipSet) }
        var memberGroupsHandler: suspend (Int, String) -> Result<CircleMemberGroups> = { _, _ ->
            Result.success(CircleMemberGroups(emptyList(), emptyList(), emptyList()))
        }
        var updateHandler: suspend () -> Result<Unit> = { Result.success(Unit) }
        var membershipSet: Set<String> = emptySet()
        private var backendURL = "https://api.example.test"
        private var cookie = "fictional-cookie"

        override fun updateApi(api: MobileApiClient): Boolean {
            val changed = backendURL != api.backendURL
            backendURL = api.backendURL
            return changed
        }

        override fun updateSession(session: MemberSession): Boolean {
            val changed = cookie != session.cookieHeader
            cookie = session.cookieHeader
            return changed
        }

        override suspend fun circles(): Result<List<TrustrootsCircle>> = Result.success(listOf(circle()))

        override suspend fun circleBySlug(slug: String): Result<TrustrootsCircle> = circleHandler(++circleReads)

        override suspend fun memberships(): Result<Set<String>> = membershipsHandler(++membershipReads)

        override suspend fun circleMembers(slug: String): Result<CircleMemberGroups> {
            memberGroupSlugs += slug
            return memberGroupsHandler(memberGroupSlugs.size, slug)
        }

        override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> {
            membershipChanges += circleID to isMember
            return updateHandler()
        }
    }

    private companion object {
        fun api(url: String) = MobileApiClient(url)

        fun session(cookie: String) = MemberSession(
            cookie,
            MobileMember("anonymous-member", "Anonymous Member"),
        )

        fun circle() = TrustrootsCircle(
            id = "quiet-id",
            slug = "quiet-circle",
            label = "Quiet Circle",
            description = "A fictional circle description",
            count = 7,
            image = false,
            color = null,
        )

        fun groups(username: String, displayName: String) = CircleMemberGroups(
            contacts = listOf(MessageMember("member-$username", username, displayName)),
            recommenders = emptyList(),
            active = emptyList(),
        )
    }
}
