package org.trustroots.android.ui.membersearch

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import java.io.IOException
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
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.ui.MemberShellViewModelStoreOwner

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberSearchViewModelTest {
    @Test
    fun factoryRejectsAnUnrelatedViewModelType() {
        val failure = runCatching {
            MemberSearchViewModel.Factory(FakeMemberSearchRepository())
                .create(OtherViewModel::class.java)
        }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }

    @Test
    fun requiresThreeCharactersAndSubmitsTheCurrentQuery() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        val viewModel = MemberSearchViewModel(repository, scope)

        viewModel.onEvent(MemberSearchEvent.QueryChanged("ab"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertTrue(repository.queries.isEmpty())

        viewModel.onEvent(MemberSearchEvent.QueryChanged("  quiet fox  "))
        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals(listOf("  quiet fox  "), repository.queries)
        assertEquals(listOf(member("quiet-fox", "Quiet Fox")), viewModel.state.value.results)
        assertTrue(viewModel.state.value.hasSearched)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun queryEditsAndResetClearResultsFailureAndScrollPosition() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        viewModel.onEvent(MemberSearchEvent.ResultsScrolled(84))

        viewModel.onEvent(MemberSearchEvent.QueryChanged("new query"))

        assertEquals("new query", viewModel.state.value.query)
        assertTrue(viewModel.state.value.results.isEmpty())
        assertFalse(viewModel.state.value.hasSearched)
        assertEquals(0, viewModel.state.value.resultScrollOffset)
        assertNull(viewModel.state.value.failure)

        repository.searchHandler = { Result.failure(IOException("A temporary failure.")) }
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertEquals(
            MemberSearchFailure(MemberSearchFailureKind.SEARCH, null),
            viewModel.state.value.failure,
        )

        viewModel.onEvent(MemberSearchEvent.Reset())

        assertEquals(MemberSearchUiState(), viewModel.state.value)
    }

    @Test
    fun retryAfterFailureLoadsResults() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { call ->
            if (call == 1) Result.failure(IOException("A temporary failure."))
            else Result.success(listOf(member("quiet-fox", "Quiet Fox")))
        }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertNull(viewModel.state.value.failure?.serverMessage)

        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals(2, repository.queries.size)
        assertEquals(listOf(member("quiet-fox", "Quiet Fox")), viewModel.state.value.results)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun repositoryExceptionBecomesRetryableFailureAndNextSubmissionSucceeds() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { call ->
            if (call == 1) throw IOException("Temporary repository exception")
            Result.success(listOf(member("steady-owl", "Steady Owl")))
        }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("steady"))

        viewModel.onEvent(MemberSearchEvent.Submit)
        assertFalse(viewModel.state.value.isLoading)
        assertEquals(MemberSearchFailureKind.SEARCH, viewModel.state.value.failure?.kind)
        assertTrue(viewModel.state.value.results.isEmpty())

        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals(listOf("steady", "steady"), repository.queries)
        assertEquals(listOf(member("steady-owl", "Steady Owl")), viewModel.state.value.results)
        assertNull(viewModel.state.value.failure)
    }

    @Test
    fun inFlightSubmissionIsNotDuplicated() = withScope { scope ->
        val response = CompletableDeferred<Result<List<MemberProfile>>>()
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { withContext(NonCancellable) { response.await() } }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("steady"))

        viewModel.onEvent(MemberSearchEvent.Submit)
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertEquals(listOf("steady"), repository.queries)
        assertTrue(viewModel.state.value.isLoading)

        response.complete(Result.success(listOf(member("steady-owl", "Steady Owl"))))

        assertEquals(listOf(member("steady-owl", "Steady Owl")), viewModel.state.value.results)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun staleVersionedResetCannotClearCurrentEntryStateAndScrollNeverGoesNegative() = withScope { scope ->
        val viewModel = MemberSearchViewModel(FakeMemberSearchRepository(), scope)
        viewModel.onEvent(MemberSearchEvent.Reset(generation = 8))
        viewModel.onEvent(MemberSearchEvent.QueryChanged("current query"))
        viewModel.onEvent(MemberSearchEvent.ResultsScrolled(-4))
        viewModel.onEvent(MemberSearchEvent.Reset(generation = 7))

        assertEquals("current query", viewModel.state.value.query)
        assertEquals(0, viewModel.state.value.resultScrollOffset)
    }

    @Test
    fun storesOnlyNonblankApiServerMessageAndFailureKind() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = {
            Result.failure(
                MobileApiException(
                    statusCode = 503,
                    serverMessage = "A fictional response message.",
                    failureKind = ApiFailureKind.REQUEST_REJECTED,
                ),
            )
        }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))
        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals("A fictional response message.", viewModel.state.value.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, viewModel.state.value.failure?.apiKind)

        repository.searchHandler = {
            Result.failure(MobileApiException(503, serverMessage = "  \t", failureKind = ApiFailureKind.REQUEST_REJECTED))
        }
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertNull(viewModel.state.value.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, viewModel.state.value.failure?.apiKind)
    }

    @Test
    fun successfulEmptyResponseIsACompletedSearchWithoutFailure() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { Result.success(emptyList()) }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))

        viewModel.onEvent(MemberSearchEvent.Submit)

        assertTrue(viewModel.state.value.hasSearched)
        assertTrue(viewModel.state.value.results.isEmpty())
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun replacedQueryIgnoresLateResultsAndSubmitsTheCurrentQueryAfterOldRequestFinishes() = withScope { scope ->
        val oldResponse = CompletableDeferred<Result<List<MemberProfile>>>()
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldResponse.await() }
            else Result.success(listOf(member("current-owl", "Current Owl")))
        }
        val viewModel = MemberSearchViewModel(repository, scope)

        viewModel.onEvent(MemberSearchEvent.QueryChanged("old query"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertTrue(viewModel.state.value.isLoading)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("current query"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        assertTrue(viewModel.state.value.isLoading)
        assertTrue(viewModel.state.value.results.isEmpty())

        oldResponse.complete(Result.success(listOf(member("old-fox", "Old Fox"))))

        assertFalse(viewModel.state.value.isLoading)
        assertTrue(viewModel.state.value.results.isEmpty())
        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals(listOf("current-owl"), viewModel.state.value.results.map { it.username })
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun queryChangedReentrantlyDuringSearchDoesNotPublishResultsForTheOldQuery() = withScope { scope ->
        lateinit var viewModel: MemberSearchViewModel
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { call ->
            if (call == 1) {
                viewModel.onEvent(MemberSearchEvent.QueryChanged("current query"))
                Result.success(listOf(member("old-fox", "Old Fox")))
            } else Result.success(listOf(member("current-owl", "Current Owl")))
        }
        viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("old query"))

        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals("current query", viewModel.state.value.query)
        assertTrue(viewModel.state.value.results.isEmpty())
        assertFalse(viewModel.state.value.hasSearched)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun reentrantResetDuringSearchKeepsTheResetStateWhenTheOldResultReturns() = withScope { scope ->
        lateinit var viewModel: MemberSearchViewModel
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = {
            viewModel.onEvent(MemberSearchEvent.Reset())
            Result.success(listOf(member("stale-fox", "Stale Fox")))
        }
        viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))

        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals(MemberSearchUiState(), viewModel.state.value)
    }

    @Test
    fun clearingTheQueryStillDeliversAnExpiredSessionFromTheSubmittedRequest() = withScope { scope ->
        val response = CompletableDeferred<Result<List<MemberProfile>>>()
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { withContext(NonCancellable) { response.await() } }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        viewModel.onEvent(MemberSearchEvent.QueryChanged(""))

        response.complete(Result.failure(MobileApiException(401, "Expired")))

        assertEquals("", viewModel.state.value.query)
        assertTrue(viewModel.state.value.results.isEmpty())
        assertEquals(1, requireNotNull(viewModel.state.value.pendingSessionInvalidation).id)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun explicitResetCancelsTheCurrentSearchAndRejectsItsLateResult() = withScope { scope ->
        val response = CompletableDeferred<Result<List<MemberProfile>>>()
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { withContext(NonCancellable) { response.await() } }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        viewModel.onEvent(MemberSearchEvent.Reset())

        response.complete(Result.success(listOf(member("old-fox", "Old Fox"))))

        assertEquals(MemberSearchUiState(), viewModel.state.value)
    }

    @Test
    fun authenticationFailureIsAcknowledgedOnceAndNeverRetried() = withScope { scope ->
        val repository = FakeMemberSearchRepository()
        repository.searchHandler = { Result.failure(MobileApiException(401, "Expired")) }
        val viewModel = MemberSearchViewModel(repository, scope)
        viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet"))
        viewModel.onEvent(MemberSearchEvent.Submit)
        val pending = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        viewModel.onEvent(MemberSearchEvent.SessionInvalidationDelivered(pending.id + 1))
        assertEquals(pending, viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(MemberSearchEvent.SessionInvalidationDelivered(pending.id))
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(MemberSearchEvent.Submit)

        assertEquals(1, repository.queries.size)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun clearingTheEntryStoreClearsItsStateAndKeepsAnotherStoreIsolated() {
        val firstStore = ViewModelStore()
        val secondStore = ViewModelStore()
        val firstScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val secondScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val first = ViewModelProvider(
                StoreOwner(firstStore),
                MemberSearchViewModel.Factory(FakeMemberSearchRepository(), firstScope),
            )[MemberSearchViewModel::class.java]
            val second = ViewModelProvider(
                StoreOwner(secondStore),
                MemberSearchViewModel.Factory(FakeMemberSearchRepository(), secondScope),
            )[MemberSearchViewModel::class.java]
            first.onEvent(MemberSearchEvent.QueryChanged("quiet"))
            second.onEvent(MemberSearchEvent.QueryChanged("meadow"))

            firstStore.clear()

            assertEquals(MemberSearchUiState(), first.state.value)
            assertEquals("meadow", second.state.value.query)
            assertFalse(first.state.value.toString().contains("fictional-session"))
        } finally {
            firstStore.clear()
            secondStore.clear()
            firstScope.cancel()
            secondScope.cancel()
        }
    }

    @Test
    fun activityGraphContainerRetainsAccountEntriesAndClearsInflightChildrenOnSwitchOrSignOut() {
        val activityStore = ViewModelStore()
        val activityOwner = StoreOwner(activityStore)
        val graphContainer = ViewModelProvider(activityOwner)[MemberShellViewModelStoreOwner::class.java]
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val response = CompletableDeferred<Result<List<MemberProfile>>>()
        val cancelled = CompletableDeferred<Unit>()
        try {
            val firstOwner = graphContainer.activateAccount("steady-heron")
            val firstRepository = FakeMemberSearchRepository()
            firstRepository.searchHandler = {
                try {
                    response.await()
                } finally {
                    cancelled.complete(Unit)
                }
            }
            val firstAccount = ViewModelProvider(
                firstOwner,
                MemberSearchViewModel.Factory(firstRepository, scope),
            )[MemberSearchViewModel::class.java]
            firstAccount.onEvent(MemberSearchEvent.QueryChanged("private query"))
            firstAccount.onEvent(MemberSearchEvent.ResultsScrolled(98))
            firstAccount.onEvent(MemberSearchEvent.Submit)
            assertTrue(firstAccount.state.value.isLoading)

            val retainedAccount = ViewModelProvider(
                graphContainer.activateAccount("steady-heron"),
                MemberSearchViewModel.Factory(FakeMemberSearchRepository(), scope),
            )[MemberSearchViewModel::class.java]
            assertTrue(firstAccount === retainedAccount)
            assertEquals("private query", retainedAccount.state.value.query)
            assertEquals(98, retainedAccount.state.value.resultScrollOffset)

            val secondAccount = ViewModelProvider(
                graphContainer.activateAccount("amber-owl"),
                MemberSearchViewModel.Factory(FakeMemberSearchRepository(), scope),
            )[MemberSearchViewModel::class.java]
            assertFalse(firstAccount === secondAccount)
            assertEquals(MemberSearchUiState(), firstAccount.state.value)
            assertEquals(MemberSearchUiState(), secondAccount.state.value)
            assertTrue(cancelled.isCompleted)

            secondAccount.onEvent(MemberSearchEvent.QueryChanged("another private query"))
            graphContainer.clearAccount()
            assertEquals(MemberSearchUiState(), secondAccount.state.value)

            val freshAccount = ViewModelProvider(
                graphContainer.activateAccount("amber-owl"),
                MemberSearchViewModel.Factory(FakeMemberSearchRepository(), scope),
            )[MemberSearchViewModel::class.java]
            assertFalse(secondAccount === freshAccount)
            assertEquals(MemberSearchUiState(), freshAccount.state.value)

            freshAccount.onEvent(MemberSearchEvent.QueryChanged("entry scoped query"))
            activityStore.clear()
            assertEquals(MemberSearchUiState(), freshAccount.state.value)
        } finally {
            activityStore.clear()
            scope.cancel()
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

    private class OtherViewModel : ViewModel()

    private class FakeMemberSearchRepository : MemberSearchRepository {
        var queries = mutableListOf<String>()
        var searchHandler: suspend (Int) -> Result<List<MemberProfile>> = {
            Result.success(listOf(member("quiet-fox", "Quiet Fox")))
        }

        override suspend fun searchMembers(query: String): Result<List<MemberProfile>> {
            queries += query
            return searchHandler(queries.size)
        }
    }

    private companion object {
        fun member(username: String, name: String) = MemberProfile(
            id = "member-$username",
            username = username,
            displayName = name,
            tagline = null,
            description = null,
            location = null,
            languages = emptyList(),
        )
    }
}
