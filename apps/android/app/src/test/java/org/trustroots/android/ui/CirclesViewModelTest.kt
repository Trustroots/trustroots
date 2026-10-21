package org.trustroots.android.ui

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import java.io.IOException
import kotlinx.coroutines.CancellationException
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
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CirclesViewModelTest {
    @Test
    fun loadsCatalogueAndMembershipsAndDerivesSortedDescriptionFilter() = withScope { scope ->
        val repository = FakeCircleRepository(
            circles = listOf(
                circle("circle-z", "Quiet Coast", 4, "<p>Long sea routes</p>"),
                circle("circle-a", "Quiet Coast", 4, null),
                circle("circle-b", "Mountain", 8, null),
            ),
            memberships = setOf("circle-z"),
        )
        val viewModel = CirclesViewModel(repository, scope = scope)

        assertEquals(1, repository.circleReads)
        assertEquals(1, repository.membershipReads)
        assertFalse(viewModel.state.value.isLoading)
        assertEquals(listOf("circle-b", "circle-z", "circle-a"), viewModel.state.value.visibleCircles.map { it.id })
        assertEquals(setOf("circle-z"), viewModel.state.value.memberships)

        viewModel.onEvent(CirclesEvent.FilterChanged("  SEA "))

        assertEquals(listOf("circle-z"), viewModel.state.value.visibleCircles.map { it.id })
    }

    @Test
    fun joinsLeavesAndKeepsMembershipOnMutationFailure() = withScope { scope ->
        val repository = FakeCircleRepository()
        val circle = circle("circle-one", "Harbour", 3)
        val viewModel = CirclesViewModel(repository, scope = scope)

        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
        assertEquals(setOf("circle-one"), viewModel.state.value.memberships)
        assertEquals(listOf("circle-one" to false), repository.membershipChanges)

        repository.updateResult = Result.failure(IOException("The circle could not be left."))
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
        assertEquals(setOf("circle-one"), viewModel.state.value.memberships)
        assertEquals("The circle could not be left.", viewModel.state.value.failure?.serverMessage)
        assertEquals(CirclesFailureKind.MEMBERSHIP_UPDATE, viewModel.state.value.failure?.kind)
        assertNull(viewModel.state.value.updatingCircleID)

        repository.updateResult = Result.success(Unit)
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
        assertTrue(viewModel.state.value.memberships.isEmpty())
        assertEquals(listOf(false, true, true), repository.membershipChanges.map { it.second })
    }

    @Test
    fun repeatedMembershipTapIsIgnoredUntilTheFirstUpdateCompletes() = withScope { scope ->
        val pendingUpdate = CompletableDeferred<Result<Unit>>()
        val repository = FakeCircleRepository().apply {
            updateHandler = { _, _ -> pendingUpdate.await() }
        }
        val circle = circle("circle-one", "Harbour", 3)
        val viewModel = CirclesViewModel(repository, scope = scope)

        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))

        assertEquals(listOf("circle-one" to false), repository.membershipChanges)
        assertEquals("circle-one", viewModel.state.value.updatingCircleID)
        pendingUpdate.complete(Result.success(Unit))
        assertEquals(setOf("circle-one"), viewModel.state.value.memberships)
        assertNull(viewModel.state.value.updatingCircleID)

        // Once the acknowledged update settles, the member can immediately leave again.
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))

        assertEquals(listOf("circle-one" to false, "circle-one" to true), repository.membershipChanges)
        assertTrue(viewModel.state.value.memberships.isEmpty())
    }

    @Test
    fun membershipToggleWinsOverAnOlderMembershipSnapshotStillLoading() = withScope { scope ->
        val circle = circle("circle-one", "Harbour", 3)
        val pendingMemberships = CompletableDeferred<Result<Set<String>>>()
        val repository = FakeCircleRepository(circles = listOf(circle)).apply {
            membershipsHandler = { pendingMemberships.await() }
        }
        val viewModel = CirclesViewModel(repository, scope = scope)

        assertTrue(viewModel.state.value.isLoading)
        assertEquals(listOf("circle-one"), viewModel.state.value.circles.map { it.id })
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))

        assertEquals(setOf("circle-one"), viewModel.state.value.memberships)
        pendingMemberships.complete(Result.success(emptySet()))

        assertEquals(setOf("circle-one"), viewModel.state.value.memberships)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun loadFailureOffersRetryAndRetryReplacesTheFailureWithLoadedData() = withScope { scope ->
        val repository = FakeCircleRepository()
        repository.circlesHandler = { call ->
            if (call == 1) Result.failure(IOException("The circle catalogue is unavailable."))
            else Result.success(listOf(circle("circle-one", "Harbour", 3)))
        }
        val viewModel = CirclesViewModel(repository, scope = scope)

        assertEquals("The circle catalogue is unavailable.", viewModel.state.value.failure?.serverMessage)
        assertEquals(CirclesFailureKind.CIRCLES_LOAD, viewModel.state.value.failure?.kind)
        assertTrue(viewModel.state.value.canRetryLoad)
        assertFalse(viewModel.state.value.isLoading)

        viewModel.onEvent(CirclesEvent.RetryLoad)

        assertEquals(2, repository.circleReads)
        assertEquals(listOf("circle-one"), viewModel.state.value.circles.map { it.id })
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.canRetryLoad)
    }

    @Test
    fun thrownCatalogueAndMembershipFailuresCanBothBeRetried() = withScope { scope ->
        val repository = FakeCircleRepository()
        repository.circlesHandler = { attempt ->
            if (attempt == 1) throw IOException("Temporary catalogue failure")
            Result.success(listOf(circle("circle-recovered", "Recovered", 4)))
        }
        repository.membershipsHandler = { attempt ->
            if (attempt == 1) throw IOException("Temporary membership lookup failure")
            Result.success(setOf("circle-recovered"))
        }
        val viewModel = CirclesViewModel(repository, scope = scope)

        assertEquals(CirclesFailureKind.MEMBERSHIPS_LOAD, viewModel.state.value.failure?.kind)
        assertEquals("Temporary membership lookup failure", viewModel.state.value.failure?.serverMessage)
        assertTrue(viewModel.state.value.canRetryLoad)
        assertFalse(viewModel.state.value.isLoading)

        viewModel.onEvent(CirclesEvent.RetryLoad)

        assertEquals(listOf("circle-recovered"), viewModel.state.value.circles.map { it.id })
        assertEquals(setOf("circle-recovered"), viewModel.state.value.memberships)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.canRetryLoad)
    }

    @Test
    fun repositoryCancellationDoesNotBecomeAUserFailureAndLaterRetryCanLoad() = withScope { scope ->
        val repository = FakeCircleRepository()
        repository.circlesHandler = { attempt ->
            if (attempt == 1) throw CancellationException("Request superseded")
            Result.success(listOf(circle("circle-recovered", "Recovered", 4)))
        }
        val viewModel = CirclesViewModel(repository, scope = scope)

        assertNull(viewModel.state.value.failure)
        assertTrue(viewModel.state.value.isLoading)
        assertEquals(0, repository.membershipReads)

        viewModel.onEvent(CirclesEvent.RetryLoad)

        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
        assertEquals(listOf("circle-recovered"), viewModel.state.value.circles.map { it.id })
        assertEquals(1, repository.membershipReads)
    }

    @Test
    fun retryCancelsAnOldLoadAndItsLateResultCannotReplaceFreshData() = withScope { scope ->
        val oldResponse = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        val repository = FakeCircleRepository()
        repository.circlesHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldResponse.await() }
            else Result.success(listOf(circle("circle-current", "Current", 9)))
        }
        val viewModel = CirclesViewModel(repository, scope = scope)
        assertTrue(viewModel.state.value.isLoading)

        viewModel.onEvent(CirclesEvent.RetryLoad)
        assertEquals(listOf("circle-current"), viewModel.state.value.circles.map { it.id })

        oldResponse.complete(Result.success(listOf(circle("circle-obsolete", "Obsolete", 1))))

        assertEquals(listOf("circle-current"), viewModel.state.value.circles.map { it.id })
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun backPreservesFilterAndAReplacementEntryStartsWithFreshData() = withScope { scope ->
        val repository = FakeCircleRepository(circles = listOf(circle("circle-one", "Harbour", 3)))
        val viewModel = CirclesViewModel(repository, scope = scope)
        viewModel.onEvent(CirclesEvent.FilterChanged("harbour"))
        viewModel.onEvent(CirclesEvent.CircleSelected(repository.catalogue.single()))
        viewModel.onEvent(CirclesEvent.BackFromDetail)

        assertEquals("harbour", viewModel.state.value.filter)
        assertNull(viewModel.state.value.selectedCircle)

        val freshRepository = FakeCircleRepository(circles = listOf(circle("circle-two", "Mountain", 5)))
        val freshViewModel = CirclesViewModel(freshRepository, scope = scope)

        assertEquals(1, freshRepository.circleReads)
        assertEquals(1, freshRepository.membershipReads)
        assertEquals("", freshViewModel.state.value.filter)
        assertNull(freshViewModel.state.value.selectedCircle)
        assertEquals(listOf("circle-two"), freshViewModel.state.value.circles.map { it.id })
    }

    @Test
    fun authenticationInvalidationIsIdentifiedDeduplicatedAndAcknowledged() = withScope { scope ->
        val repository = FakeCircleRepository()
        val membershipResponse = CompletableDeferred<Result<Set<String>>>()
        repository.circlesHandler = { Result.failure(MobileApiException(401, "Expired")) }
        repository.membershipsHandler = { membershipResponse.await() }
        val viewModel = CirclesViewModel(repository, scope = scope)
        val first = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        assertEquals(1, repository.circleReads)
        assertEquals(1, repository.membershipReads)
        assertNull(viewModel.state.value.failure)
        viewModel.onEvent(CirclesEvent.SessionInvalidationDelivered(first.id + 1))
        assertEquals(first, viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(CirclesEvent.SessionInvalidationDelivered(first.id))
        assertNull(viewModel.state.value.pendingSessionInvalidation)

        membershipResponse.complete(Result.failure(MobileApiException(401, "Expired")))
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertFalse(viewModel.state.value.isLoading)

        viewModel.onEvent(CirclesEvent.RetryLoad)

        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertEquals(1, repository.membershipReads)
    }

    @Test
    fun renewedSessionCancelsOldAccountStateAndRetriesAfterAuthenticationInvalidation() = withScope { scope ->
        val repository = FakeCircleRepository()
        repository.updateSession(session("connect.sid=old-session"))
        repository.circlesHandler = { call ->
            if (call == 1) Result.failure(MobileApiException(401, "Expired"))
            else Result.success(listOf(circle("circle-renewed", "Renewed", 6)))
        }
        val viewModel = CirclesViewModel(repository, scope = scope)
        val invalidation = requireNotNull(viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(CirclesEvent.SessionInvalidationDelivered(invalidation.id))

        viewModel.updateSession(session("connect.sid=renewed-session"))

        assertEquals(2, repository.circleReads)
        assertEquals(listOf("circle-renewed"), viewModel.state.value.circles.map { it.id })
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun accountRepositoriesAndNavigationStoresDoNotShareCirclesState() {
        val firstScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val secondScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val firstStore = ViewModelStore()
        val secondStore = ViewModelStore()
        try {
            val first = ViewModelProvider(
                StoreOwner(firstStore),
                CirclesViewModel.Factory(
                    FakeCircleRepository(circles = listOf(circle("account-one", "First account", 1))),
                    firstScope,
                ),
            )[CirclesViewModel::class.java]
            val second = ViewModelProvider(
                StoreOwner(secondStore),
                CirclesViewModel.Factory(
                    FakeCircleRepository(circles = listOf(circle("account-two", "Second account", 1))),
                    secondScope,
                ),
            )[CirclesViewModel::class.java]

            assertEquals(listOf("account-one"), first.state.value.circles.map { it.id })
            assertEquals(listOf("account-two"), second.state.value.circles.map { it.id })

            firstStore.clear()

            assertEquals(CirclesUiState(isLoading = false), first.state.value)
            assertEquals(listOf("account-two"), second.state.value.circles.map { it.id })
        } finally {
            firstStore.clear()
            secondStore.clear()
            firstScope.cancel()
            secondScope.cancel()
        }
    }

    private fun withScope(test: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            test(scope)
        } finally {
            scope.cancel()
        }
    }

    private class StoreOwner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class FakeCircleRepository(
        var circles: List<TrustrootsCircle> = emptyList(),
        private val memberships: Set<String> = emptySet(),
    ) : CircleRepository {
        var circleReads = 0
        var membershipReads = 0
        var updateResult: Result<Unit> = Result.success(Unit)
        var updateHandler: suspend (String, Boolean) -> Result<Unit> = { _, _ -> updateResult }
        private var currentSession: MemberSession? = null
        var circlesHandler: suspend (Int) -> Result<List<TrustrootsCircle>> = { Result.success(circles) }
        var membershipsHandler: suspend (Int) -> Result<Set<String>> = { Result.success(memberships) }
        val catalogue: List<TrustrootsCircle> get() = circles
        val membershipChanges = mutableListOf<Pair<String, Boolean>>()

        override fun updateSession(session: MemberSession): Boolean {
            val changed = currentSession?.let {
                it.cookieHeader != session.cookieHeader || it.member.username != session.member.username
            } ?: false
            currentSession = session
            return changed
        }

        override suspend fun circles(): Result<List<TrustrootsCircle>> = circlesHandler(++circleReads)

        override suspend fun memberships(): Result<Set<String>> = membershipsHandler(++membershipReads)

        override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> {
            membershipChanges += circleID to isMember
            return updateHandler(circleID, isMember)
        }
    }

    private companion object {
        fun session(cookie: String) = MemberSession(cookie, MobileMember("quiet-fox", "Quiet Fox"))

        fun circle(id: String, label: String, count: Int, description: String? = null) = TrustrootsCircle(
            id = id,
            slug = id,
            label = label,
            description = description,
            count = count,
            image = false,
            color = null,
        )
    }
}
