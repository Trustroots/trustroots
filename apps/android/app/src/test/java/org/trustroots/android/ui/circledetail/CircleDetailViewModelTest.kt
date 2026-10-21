package org.trustroots.android.ui.circledetail

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
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
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.circles.CircleRepository
import org.trustroots.android.ui.circles.CirclesFailureKind
import org.trustroots.android.ui.circles.CirclesSessionInvalidation

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CircleDetailViewModelTest {
    @Test
    fun detailLoadsCircleByCanonicalSlugAndLoadsMembershipIndependently() = withDetail { viewModel, repository, _ ->
        assertEquals(listOf("quiet-circle"), repository.detailSlugs)
        assertEquals(0, repository.catalogueReads)
        assertEquals(1, repository.membershipReads)
        assertEquals(circle("quiet-id", "quiet-circle", "Quiet Circle", 7), viewModel.state.value.circle)
        assertTrue(viewModel.state.value.membershipsLoaded)
        assertFalse(viewModel.state.value.isMember)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun joinAndLeaveUseFetchedCircleIDAndEmitOverviewUpdatesWithoutChangingCount() = withDetail { viewModel, repository, _ ->
        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)
        assertTrue(viewModel.state.value.isMember)
        assertEquals(7, viewModel.state.value.circle?.count)
        val joined = requireNotNull(viewModel.state.value.pendingOverviewMembershipEvent)
        assertEquals("quiet-id", joined.circleID)
        assertTrue(joined.isMember)
        viewModel.onEvent(CircleDetailEvent.OverviewMembershipEventDelivered(joined.id))
        assertNull(viewModel.state.value.pendingOverviewMembershipEvent)

        viewModel.onEvent(CircleDetailEvent.ToggleMembership)
        assertEquals(listOf("quiet-id" to false, "quiet-id" to true), repository.membershipChanges)
        assertFalse(viewModel.state.value.isMember)
        val left = requireNotNull(viewModel.state.value.pendingOverviewMembershipEvent)
        assertFalse(left.isMember)
        viewModel.onEvent(CircleDetailEvent.OverviewMembershipEventDelivered(joined.id))
        assertEquals("A prior join acknowledgement must not consume the current leave event", left, viewModel.state.value.pendingOverviewMembershipEvent)
        viewModel.onEvent(CircleDetailEvent.OverviewMembershipEventDelivered(left.id))
        assertNull(viewModel.state.value.pendingOverviewMembershipEvent)
        viewModel.onEvent(CircleDetailEvent.OverviewMembershipEventDelivered(left.id))
        assertNull(viewModel.state.value.pendingOverviewMembershipEvent)
    }

    @Test
    fun missingSlugShowsRetryableDetailFailureAndDoesNotUseOverviewPayload() = withRepository { repository, scope ->
        repository.circleHandler = { _, _ -> Result.failure(IOException("No canonical circle")) }
        val fresh = CircleDetailViewModel("missing-slug", repository, scope = scope)

        assertNull(fresh.state.value.circle)
        assertEquals(CirclesFailureKind.CIRCLE_DETAIL_LOAD, fresh.state.value.failure?.kind)
        assertTrue(fresh.state.value.canRetryLoad)
        assertEquals(0, repository.catalogueReads)
        fresh.onEvent(CircleDetailEvent.RetryLoad)

        assertNull(fresh.state.value.circle)
        assertEquals(listOf("missing-slug", "missing-slug"), repository.detailSlugs)
    }

    @Test
    fun retryReloadsCircleAndMembershipWhenMembershipReadFails() = withRepository { repository, scope ->
        val failingMembershipCall = repository.membershipReads + 1
        repository.membershipsHandler = { call ->
            if (call == failingMembershipCall) Result.failure(IOException("Membership unavailable"))
            else Result.success(setOf("quiet-id"))
        }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)

        assertEquals("quiet-id", fresh.state.value.circle?.id)
        assertFalse(fresh.state.value.membershipsLoaded)
        assertEquals(CirclesFailureKind.MEMBERSHIPS_LOAD, fresh.state.value.failure?.kind)
        assertTrue(fresh.state.value.canRetryLoad)
        fresh.onEvent(CircleDetailEvent.RetryLoad)

        assertEquals(listOf("quiet-circle", "quiet-circle"), repository.detailSlugs)
        assertTrue(fresh.state.value.membershipsLoaded)
        assertTrue(fresh.state.value.isMember)
        assertNull(fresh.state.value.failure)
    }

    @Test
    fun thrownDetailAndMembershipExceptionsBecomeRetryableFailures() = withRepository { repository, scope ->
        repository.circleHandler = { call, slug ->
            if (call == 1) throw IOException("Temporary detail transport failure")
            Result.success(circle("quiet-id", slug, "Quiet Circle", 7))
        }
        repository.membershipsHandler = { call ->
            if (call == 1) throw IllegalStateException("Temporary membership lookup failure")
            Result.success(emptySet())
        }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)

        assertNull(fresh.state.value.circle)
        assertEquals(CirclesFailureKind.CIRCLE_DETAIL_LOAD, fresh.state.value.failure?.kind)
        assertTrue(fresh.state.value.canRetryLoad)

        fresh.onEvent(CircleDetailEvent.RetryLoad)
        assertEquals("quiet-id", fresh.state.value.circle?.id)
        assertEquals(CirclesFailureKind.MEMBERSHIPS_LOAD, fresh.state.value.failure?.kind)
        assertTrue(fresh.state.value.canRetryLoad)

        fresh.onEvent(CircleDetailEvent.RetryLoad)
        assertTrue(fresh.state.value.membershipsLoaded)
        assertFalse(fresh.state.value.isMember)
        assertNull(fresh.state.value.failure)
        assertEquals(listOf("quiet-circle", "quiet-circle", "quiet-circle"), repository.detailSlugs)
    }

    @Test
    fun membershipFailurePreservesStatusAndCanBeRetried() = withRepository { repository, scope ->
        repository.membershipSet = setOf("quiet-id")
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        repository.updateHandler = {
            if (repository.membershipChanges.size == 1) {
                Result.failure(
                    MobileApiException(
                        statusCode = 503,
                        serverMessage = "Temporary membership failure",
                        failureKind = ApiFailureKind.REQUEST_REJECTED,
                    ),
                )
            } else Result.success(Unit)
        }

        fresh.onEvent(CircleDetailEvent.ToggleMembership)
        assertTrue(fresh.state.value.isMember)
        assertFalse(fresh.state.value.isUpdating)
        assertEquals(CirclesFailureKind.MEMBERSHIP_UPDATE, fresh.state.value.failure?.kind)
        assertEquals("Temporary membership failure", fresh.state.value.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, fresh.state.value.failure?.apiFailureKind)

        fresh.onEvent(CircleDetailEvent.ToggleMembership)
        assertFalse(fresh.state.value.isMember)
        assertNull(fresh.state.value.failure)
    }

    @Test
    fun thrownMembershipMutationFailureKeepsStateAndCanBeRetried() = withRepository { repository, scope ->
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        repository.updateHandler = {
            if (repository.membershipChanges.size == 1) throw IllegalStateException("Temporary update failure")
            Result.success(Unit)
        }

        fresh.onEvent(CircleDetailEvent.ToggleMembership)

        assertFalse(fresh.state.value.isMember)
        assertFalse(fresh.state.value.isUpdating)
        assertEquals(CirclesFailureKind.MEMBERSHIP_UPDATE, fresh.state.value.failure?.kind)
        assertFalse(fresh.state.value.canRetryLoad)

        fresh.onEvent(CircleDetailEvent.ToggleMembership)

        assertTrue(fresh.state.value.isMember)
        assertFalse(fresh.state.value.isUpdating)
        assertNull(fresh.state.value.failure)
        assertEquals(2, repository.membershipChanges.size)
    }

    @Test
    fun lateDetailResponseAfterRetryCannotReplaceCurrentSlugData() = withRepository { repository, scope ->
        val old = CompletableDeferred<Result<TrustrootsCircle>>()
        val oldCall = repository.detailSlugs.size + 1
        repository.circleHandler = { call, _ ->
            if (call == oldCall) withContext(NonCancellable) { old.await() }
            else Result.success(circle("current-id", "quiet-circle", "Current Circle", 4))
        }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        fresh.onEvent(CircleDetailEvent.RetryLoad)
        old.complete(Result.success(circle("stale-id", "quiet-circle", "Stale Circle", 9)))

        assertEquals("current-id", fresh.state.value.circle?.id)
        assertEquals("Current Circle", fresh.state.value.circle?.label)
        assertEquals(listOf("quiet-circle", "quiet-circle"), repository.detailSlugs)
    }

    @Test
    fun sessionReplacementCancelsOldDetailAndMembershipReads() = withRepository { repository, scope ->
        val old = CompletableDeferred<Result<TrustrootsCircle>>()
        val oldCall = repository.detailSlugs.size + 1
        repository.circleHandler = { call, _ ->
            if (call == oldCall) withContext(NonCancellable) { old.await() }
            else Result.success(circle("new-account-id", "quiet-circle", "New Account Circle", 2))
        }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        repository.updateApi(api())
        fresh.updateEnvironment(api("https://other.example.test/"), session("new-cookie"))
        old.complete(Result.success(circle("old-account-id", "quiet-circle", "Old Account Circle", 5)))

        assertEquals("new-account-id", fresh.state.value.circle?.id)
        assertEquals("New Account Circle", fresh.state.value.circle?.label)
        assertFalse(fresh.state.value.isLoading)
    }

    @Test
    fun sessionReplacementRejectsLateMembershipsFromPreviousAccount() = withRepository { repository, scope ->
        val oldMemberships = CompletableDeferred<Result<Set<String>>>()
        repository.membershipsHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldMemberships.await() }
            else Result.success(setOf("new-account-id"))
        }
        repository.circleHandler = { _, _ ->
            Result.success(circle("new-account-id", "quiet-circle", "Current Circle", 4))
        }
        val viewModel = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        assertFalse(viewModel.state.value.membershipsLoaded)

        viewModel.updateEnvironment(api("https://other.example.test"), session("rotated-cookie"))
        oldMemberships.complete(Result.success(emptySet()))

        assertTrue(viewModel.state.value.membershipsLoaded)
        assertTrue(viewModel.state.value.isMember)
        assertEquals("new-account-id", viewModel.state.value.circle?.id)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun sameNormalizedBackendClientReplacementDoesNotReloadDetail() = withRepository { repository, scope ->
        repository.updateApi(api("https://api.example.test"))
        repository.updateSession(session("stable-cookie"))
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)

        fresh.updateEnvironment(api("https://api.example.test/"), session("stable-cookie"))

        assertEquals(listOf("quiet-circle"), repository.detailSlugs)
        assertEquals(1, repository.membershipReads)
        assertFalse(fresh.state.value.isLoading)
    }

    @Test
    fun sameBackendClientReplacementDoesNotRepeatPendingMembershipMutation() = withRepository { repository, scope ->
        repository.updateApi(api("https://api.example.test"))
        repository.updateSession(session("stable-cookie"))
        val pending = CompletableDeferred<Result<Unit>>()
        repository.updateHandler = { pending.await() }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)

        fresh.onEvent(CircleDetailEvent.ToggleMembership)
        fresh.updateEnvironment(api("https://api.example.test/"), session("stable-cookie"))

        assertEquals(listOf("quiet-id" to false), repository.membershipChanges)
        pending.complete(Result.success(Unit))
        assertTrue(fresh.state.value.isMember)
        assertEquals(1, repository.membershipChanges.size)
    }

    @Test
    fun authenticationInvalidationIsOneShotAndNewSessionLoadsFreshDetail() = withRepository { repository, scope ->
        val failingDetailCall = 1
        repository.circleHandler = { call, _ ->
            if (call == failingDetailCall) Result.failure(MobileApiException(401, "Expired"))
            else Result.success(circle("renewed-id", "quiet-circle", "Renewed Circle", 3))
        }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        val invalidation = requireNotNull(fresh.state.value.pendingSessionInvalidation)
        fresh.onEvent(CircleDetailEvent.SessionInvalidationDelivered(invalidation.id))
        fresh.onEvent(CircleDetailEvent.RetryLoad)
        assertEquals(listOf("quiet-circle"), repository.detailSlugs)

        fresh.updateEnvironment(api(), session("renewed-cookie"))
        assertEquals("renewed-id", fresh.state.value.circle?.id)
        assertEquals(listOf("quiet-circle", "quiet-circle"), repository.detailSlugs)
        assertNull(fresh.state.value.pendingSessionInvalidation)
        assertNull(fresh.state.value.failure)
    }

    @Test
    fun concurrentMembershipAndReloadAuthFailuresKeepOneInvalidationAndBlockFurtherWork() = withRepository { repository, scope ->
        repository.membershipSet = setOf("quiet-id")
        val pendingMutation = CompletableDeferred<Result<Unit>>()
        repository.updateHandler = { pendingMutation.await() }
        repository.membershipsHandler = { call ->
            if (call == 2) Result.failure(MobileApiException(401, "Expired"))
            else Result.success(repository.membershipSet)
        }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)

        fresh.onEvent(CircleDetailEvent.ToggleMembership)
        assertTrue(fresh.state.value.isUpdating)
        fresh.onEvent(CircleDetailEvent.RetryLoad)
        val invalidation = requireNotNull(fresh.state.value.pendingSessionInvalidation)
        pendingMutation.complete(Result.failure(MobileApiException(401, "Expired")))

        assertEquals("A concurrent auth failure must not replace the one pending callback", invalidation, fresh.state.value.pendingSessionInvalidation)
        assertFalse(fresh.state.value.isUpdating)
        assertEquals(listOf("quiet-circle", "quiet-circle"), repository.detailSlugs)
        assertEquals(2, repository.membershipReads)
        assertEquals(listOf("quiet-id" to true), repository.membershipChanges)

        fresh.onEvent(CircleDetailEvent.SessionInvalidationDelivered(invalidation.id))
        fresh.onEvent(CircleDetailEvent.SessionInvalidationDelivered(invalidation.id))
        fresh.onEvent(CircleDetailEvent.RetryLoad)

        assertNull(fresh.state.value.pendingSessionInvalidation)
        assertEquals("Acknowledgement must not reset the expired-session latch or repeat requests", 2, repository.detailSlugs.size)
        assertEquals(2, repository.membershipReads)
    }

    @Test
    fun staleSessionInvalidationAcknowledgementDoesNotClearANewerInvalidation() = withRepository { repository, scope ->
        repository.circleHandler = { _, slug -> Result.failure(MobileApiException(401, "Expired")) }
        val fresh = CircleDetailViewModel("quiet-circle", repository, scope = scope)
        val first = requireNotNull(fresh.state.value.pendingSessionInvalidation)
        fresh.onEvent(CircleDetailEvent.SessionInvalidationDelivered(first.id))

        fresh.updateEnvironment(api("https://other.example.test"), session("renewed-cookie"))

        val current = requireNotNull(fresh.state.value.pendingSessionInvalidation)
        assertTrue(current.id > first.id)
        fresh.onEvent(CircleDetailEvent.SessionInvalidationDelivered(first.id))
        assertEquals("The previous account's acknowledgement must not dismiss the new invalidation", current, fresh.state.value.pendingSessionInvalidation)
        fresh.onEvent(CircleDetailEvent.SessionInvalidationDelivered(current.id))
        assertNull(fresh.state.value.pendingSessionInvalidation)
    }

    @Test
    fun clearingTheEntryCancelsAnOngoingLoadWithoutTurningCancellationIntoFailure() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeCircleRepository()
        var loadCancelled = false
        repository.circleHandler = { _, _ ->
            try {
                awaitCancellation()
            } finally {
                loadCancelled = true
            }
        }
        val store = ViewModelStore()
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                CircleDetailViewModel.Factory("quiet-circle", repository, scope),
            ).get(CircleDetailViewModel::class.java)
            assertTrue(viewModel.state.value.isLoading)

            store.clear()

            assertTrue(loadCancelled)
            assertEquals(CircleDetailUiState(isLoading = false), viewModel.state.value)
        } finally {
            store.clear()
            scope.cancel()
        }
    }

    @Test
    fun clearingTheEntryCancelsAnOngoingMembershipMutationWithoutPublishingFailure() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeCircleRepository()
        var updateCancelled = false
        repository.updateHandler = {
            try {
                awaitCancellation()
            } finally {
                updateCancelled = true
            }
        }
        val store = ViewModelStore()
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                CircleDetailViewModel.Factory("quiet-circle", repository, scope),
            ).get(CircleDetailViewModel::class.java)
            viewModel.onEvent(CircleDetailEvent.ToggleMembership)
            assertTrue(viewModel.state.value.isUpdating)

            store.clear()

            assertTrue(updateCancelled)
            assertEquals(CircleDetailUiState(isLoading = false), viewModel.state.value)
        } finally {
            store.clear()
            scope.cancel()
        }
    }

    @Test
    fun removingDetailEntryCancelsItsWorkAndClearsOwnedState() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeCircleRepository()
        val pending = CompletableDeferred<Result<TrustrootsCircle>>()
        repository.circleHandler = { _, _ -> withContext(NonCancellable) { pending.await() } }
        val store = ViewModelStore()
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                CircleDetailViewModel.Factory("quiet-circle", repository, scope),
            ).get(CircleDetailViewModel::class.java)
            store.clear()
            pending.complete(Result.success(circle("late-id", "quiet-circle", "Late Circle", 1)))

            assertEquals(CircleDetailUiState(isLoading = false), viewModel.state.value)
        } finally {
            store.clear()
            scope.cancel()
        }
    }

    private fun withDetail(test: (CircleDetailViewModel, FakeCircleRepository, CoroutineScope) -> Unit) {
        withRepository { repository, scope ->
            val viewModel = CircleDetailViewModel("quiet-circle", repository, scope)
            test(viewModel, repository, scope)
        }
    }

    private fun withRepository(test: (FakeCircleRepository, CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeCircleRepository()
        try {
            test(repository, scope)
        } finally {
            scope.cancel()
        }
    }

    private class FakeCircleRepository : CircleRepository {
        var catalogueReads = 0
        var membershipReads = 0
        val detailSlugs = mutableListOf<String>()
        val membershipChanges = mutableListOf<Pair<String, Boolean>>()
        var membershipSet: Set<String> = emptySet()
        var circleHandler: suspend (Int, String) -> Result<TrustrootsCircle> = { _, slug ->
            Result.success(circle("quiet-id", slug, "Quiet Circle", 7))
        }
        var membershipsHandler: suspend (Int) -> Result<Set<String>> = { Result.success(membershipSet) }
        var updateHandler: suspend () -> Result<Unit> = { Result.success(Unit) }
        private var currentSession = "old-cookie"
        private var currentBackendURL: String? = null

        override fun updateApi(api: MobileApiClient): Boolean {
            val changed = currentBackendURL?.let { it != api.backendURL } ?: false
            currentBackendURL = api.backendURL
            return changed
        }

        override fun updateSession(session: MemberSession): Boolean {
            val changed = currentSession != session.cookieHeader
            currentSession = session.cookieHeader
            return changed
        }
        override suspend fun circles(): Result<List<TrustrootsCircle>> {
            catalogueReads++
            return Result.success(listOf(circle("quiet-id", "quiet-circle", "Quiet Circle", 7)))
        }
        override suspend fun circleBySlug(slug: String): Result<TrustrootsCircle> {
            detailSlugs += slug
            return circleHandler(detailSlugs.size, slug)
        }
        override suspend fun memberships(): Result<Set<String>> = membershipsHandler(++membershipReads)
        override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> {
            membershipChanges += circleID to isMember
            return updateHandler()
        }
    }

    private class StoreOwner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private companion object {
        fun api(baseURL: String = "https://api.example.test") = MobileApiClient(baseURL)

        fun session(cookie: String) = MemberSession(cookie, MobileMember("anonymous-member", "Anonymous Member"))
        fun circle(id: String, slug: String, label: String, count: Int) = TrustrootsCircle(
            id = id,
            slug = slug,
            label = label,
            description = "A fictional circle description",
            count = count,
            image = false,
            color = null,
        )
    }
}
