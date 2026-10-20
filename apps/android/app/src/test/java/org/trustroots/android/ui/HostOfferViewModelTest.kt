package org.trustroots.android.ui

import androidx.lifecycle.ViewModelStore
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
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class HostOfferViewModelTest {
    @Test
    fun initialLoadRetainsDefaultsAndDecodedDescriptions() {
        val form = HostOfferForm(
            id = "offer-anonymous",
            status = "maybe",
            description = AndroidHostOfferDescriptionDecoder.decode(" <p>A quiet room</p> "),
            noOfferDescription = AndroidHostOfferDescriptionDecoder.decode("<b>Unavailable</b>"),
            maxGuests = 2,
            showOnlyInMyCircles = true,
            latitude = 47.0,
            longitude = 8.0,
        )
        val repository = FakeHostOfferRepository(loadResult = Result.success(form))
        withScope { scope ->
            val viewModel = HostOfferViewModel(repository, scope)

            assertFalse(viewModel.state.value.isLoading)
            assertEquals("A quiet room", viewModel.state.value.form.description)
            assertEquals("Unavailable", viewModel.state.value.form.noOfferDescription)
            assertEquals(form.toUpdate(), viewModel.state.value.original)
            assertFalse(viewModel.state.value.isDirty)
        }
    }

    @Test
    fun freshOfferUsesCurrentDefaultsAndValidation() = withScope { scope ->
        val viewModel = HostOfferViewModel(FakeHostOfferRepository(), scope)

        assertEquals(HostOfferForm(), viewModel.state.value.form)
        assertTrue(viewModel.state.value.descriptionTooShort)
        assertFalse(viewModel.state.value.isDirty)
        assertEquals(DEFAULT_HOST_LATITUDE, viewModel.state.value.form.latitude, 0.0)
        assertEquals(DEFAULT_HOST_LONGITUDE, viewModel.state.value.form.longitude, 0.0)

        viewModel.onEvent(HostOfferEvent.StatusChanged("no"))
        assertFalse(viewModel.state.value.descriptionTooShort)
        viewModel.onEvent(HostOfferEvent.StatusChanged("yes"))
        viewModel.onEvent(HostOfferEvent.DescriptionChanged("Room"))
        assertTrue(viewModel.state.value.descriptionTooShort)
        viewModel.onEvent(HostOfferEvent.DescriptionChanged(" A room "))
        assertFalse(viewModel.state.value.descriptionTooShort)
    }

    @Test
    fun loadFailureKeepsApiKindAndRetryLoadsACompleteBaseline() = withScope { scope ->
        val repository = FakeHostOfferRepository().apply {
            loadHandler = { call ->
                if (call == 1) {
                    Result.failure(
                        MobileApiException(
                            statusCode = 503,
                            serverMessage = "  ",
                            failureKind = ApiFailureKind.REQUEST_REJECTED,
                        ),
                    )
                } else Result.success(HostOfferForm(id = "offer-loaded"))
            }
        }
        val viewModel = HostOfferViewModel(repository, scope)

        assertFalse(viewModel.state.value.isLoading)
        assertNull(viewModel.state.value.original)
        assertEquals(
            UiFailure(apiKind = ApiFailureKind.REQUEST_REJECTED, fallback = UiFailureFallback.HOST_OFFER_LOAD),
            viewModel.state.value.failure,
        )
        viewModel.onEvent(HostOfferEvent.RetryLoad)

        assertEquals(2, repository.loadCalls)
        assertEquals("offer-loaded", viewModel.state.value.original?.id)
        assertNull(viewModel.state.value.failure)
    }

    @Test
    fun authenticationFailureIsEmittedOnceAndDisablesRetry() = withScope { scope ->
        val repository = FakeHostOfferRepository(
            loadResult = Result.failure(MobileApiException(statusCode = 401, serverMessage = "Expired")),
        )
        val viewModel = HostOfferViewModel(repository, scope)
        val invalidation = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        viewModel.onEvent(HostOfferEvent.SessionInvalidationDelivered(invalidation.id))
        viewModel.onEvent(HostOfferEvent.RetryLoad)

        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertNull(viewModel.state.value.failure)
        assertEquals(1, repository.loadCalls)
    }

    @Test
    fun editsTrackDirtyStateAndMaximumGuestsNormalisation() = withScope { scope ->
        val viewModel = HostOfferViewModel(FakeHostOfferRepository(), scope)

        viewModel.onEvent(HostOfferEvent.DescriptionChanged("A quiet room"))
        viewModel.onEvent(HostOfferEvent.MaximumGuestsChanged("30"))
        assertTrue(viewModel.state.value.isDirty)
        assertEquals(20, viewModel.state.value.form.maxGuests)
        viewModel.onEvent(HostOfferEvent.MaximumGuestsChanged(""))
        assertEquals(20, viewModel.state.value.form.maxGuests)
        viewModel.onEvent(HostOfferEvent.DescriptionChanged(""))
        viewModel.onEvent(HostOfferEvent.MaximumGuestsChanged("1"))

        assertFalse(viewModel.state.value.isDirty)
    }

    @Test
    fun saveUsesOneStableSnapshotAndReturnedIDForTheNewBaseline() = withScope { scope ->
        val pendingSave = CompletableDeferred<Result<AccommodationOffer>>()
        val repository = FakeHostOfferRepository().apply { saveHandler = { pendingSave.await() } }
        val viewModel = HostOfferViewModel(repository, scope)
        viewModel.onEvent(HostOfferEvent.StatusChanged("maybe"))
        viewModel.onEvent(HostOfferEvent.DescriptionChanged("A longer room description"))
        viewModel.onEvent(HostOfferEvent.MaximumGuestsChanged("4"))
        val submitted = viewModel.state.value.current

        viewModel.onEvent(HostOfferEvent.Save)
        viewModel.onEvent(HostOfferEvent.Save)
        viewModel.onEvent(HostOfferEvent.DescriptionChanged("late edit"))

        assertTrue(viewModel.state.value.isSaving)
        assertEquals(listOf(submitted), repository.submitted)
        pendingSave.complete(Result.success(hostOffer("server-issued-id")))

        val state = viewModel.state.value
        assertFalse(state.isSaving)
        assertEquals("server-issued-id", state.form.id)
        assertEquals(submitted.copy(id = "server-issued-id"), state.original)
        assertEquals(submitted.copy(id = "server-issued-id"), state.current)
        assertFalse(state.isDirty)
        assertTrue(state.saveSucceeded)
    }

    @Test
    fun saveFailurePreservesFormAndCanBeRetried() = withScope { scope ->
        val repository = FakeHostOfferRepository().apply {
            saveHandler = { call ->
                if (call == 1) Result.failure(IOException("local diagnostic"))
                else Result.success(hostOffer("returned-id"))
            }
        }
        val viewModel = HostOfferViewModel(repository, scope)
        viewModel.onEvent(HostOfferEvent.DescriptionChanged("A suitable room"))
        val submitted = viewModel.state.value.current

        viewModel.onEvent(HostOfferEvent.Save)

        assertEquals(submitted, viewModel.state.value.current)
        assertEquals(HostOfferForm().toUpdate(), viewModel.state.value.original)
        assertTrue(viewModel.state.value.isDirty)
        assertEquals(UiFailure(fallback = UiFailureFallback.HOST_OFFER_SAVE), viewModel.state.value.failure)

        viewModel.onEvent(HostOfferEvent.Save)
        assertEquals(2, repository.saveCalls)
        assertEquals("returned-id", viewModel.state.value.form.id)
        assertEquals(submitted.copy(id = "returned-id"), viewModel.state.value.original)
        assertFalse(viewModel.state.value.isDirty)
    }

    @Test
    fun retryCancelsAnObsoleteLoadAndDoesNotAcceptItsLateResult() = withScope { scope ->
        val firstLoad = CompletableDeferred<Result<HostOfferForm>>()
        val repository = FakeHostOfferRepository().apply {
            loadHandler = { call ->
                if (call == 1) withContext(NonCancellable) { firstLoad.await() }
                else Result.success(HostOfferForm(id = "current-offer"))
            }
        }
        val viewModel = HostOfferViewModel(repository, scope)
        viewModel.onEvent(HostOfferEvent.RetryLoad)
        firstLoad.complete(Result.success(HostOfferForm(id = "obsolete-offer")))

        assertEquals(2, repository.loadCalls)
        assertEquals("current-offer", viewModel.state.value.form.id)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun removingTheEntryCancelsOwnedWorkAndClearsItsState() {
        val pendingLoad = CompletableDeferred<Result<HostOfferForm>>()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeHostOfferRepository().apply {
            loadHandler = { withContext(NonCancellable) { pendingLoad.await() } }
        }
        val store = ViewModelStore()
        val owner = TestStoreOwner(store)
        try {
            val viewModel = androidx.lifecycle.ViewModelProvider(owner, HostOfferViewModel.Factory(repository, scope))
                .get(HostOfferViewModel::class.java)
            store.clear()
            pendingLoad.complete(Result.success(HostOfferForm(id = "late-offer")))

            assertEquals(HostOfferUiState(isLoading = false), viewModel.state.value)
        } finally {
            store.clear()
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

    private class TestStoreOwner(override val viewModelStore: ViewModelStore) : androidx.lifecycle.ViewModelStoreOwner

    private class FakeHostOfferRepository(
        private val loadResult: Result<HostOfferForm> = Result.success(HostOfferForm()),
    ) : HostOfferRepository {
        var loadCalls = 0
        var saveCalls = 0
        val submitted = mutableListOf<HostOfferUpdate>()
        var loadHandler: suspend (Int) -> Result<HostOfferForm> = { loadResult }
        var saveHandler: suspend (Int) -> Result<AccommodationOffer> = { Result.success(hostOffer("saved-offer")) }

        override suspend fun load(): Result<HostOfferForm> = loadHandler(++loadCalls)

        override suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer> {
            submitted += update
            return saveHandler(++saveCalls)
        }
    }

}

private fun hostOffer(id: String) = AccommodationOffer(
    id = id,
    status = "maybe",
    description = "A room",
    noOfferDescription = "",
    maxGuests = 4,
    showOnlyInMyCircles = false,
    latitude = 47.0,
    longitude = 8.0,
)
