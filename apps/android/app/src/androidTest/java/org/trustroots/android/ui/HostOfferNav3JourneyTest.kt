package org.trustroots.android.ui

import androidx.test.core.app.ActivityScenario
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.HostOfferUpdate

@RunWith(AndroidJUnit4::class)
class HostOfferNav3JourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private var scenario: ActivityScenario<HostOfferNav3TestActivity>? = null

    @After
    fun closeScenario() {
        scenario?.close()
        scenario = null
        HostOfferNav3JourneyProvider.repository = null
    }

    @Test
    fun loadRecreationBackGuardAndReentryUseTheEntryOwnedViewModel() {
        val pendingLoad = CompletableDeferred<Result<HostOfferForm>>()
        val repository = JourneyHostOfferRepository(
            loadHandler = { call ->
                if (call == 1) pendingLoad.await()
                else Result.success(HostOfferForm(id = "fresh-entry"))
            },
        )
        launch(repository)
        compose.onNodeWithText("Open hosting form").performClick()
        compose.waitUntil(5_000) { repository.loadCalls.get() == 1 }
        scenario?.recreate()
        pendingLoad.complete(Result.success(HostOfferForm(id = "loaded-entry", description = "A quiet room")))
        compose.onNodeWithText("A quiet room").assertIsDisplayed()
        assertEquals("Activity recreation must not restart the load", 1, repository.loadCalls.get())

        compose.onNodeWithText("Hosting description").performTextReplacement("A changed room description")
        pressSystemBack()
        compose.onNodeWithText("Keep editing").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("A changed room description").assertIsDisplayed()

        pressSystemBack()
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithText("Open hosting form").assertIsDisplayed()
        compose.onNodeWithText("Open hosting form").performClick()
        compose.onNodeWithText("Maximum guests").assertIsDisplayed()
        assertEquals("A newly pushed entry loads fresh state", 2, repository.loadCalls.get())
    }

    @Test
    fun activityRecreationDuringSaveDoesNotDuplicateTheSubmittedSnapshot() {
        val pendingSave = CompletableDeferred<Result<AccommodationOffer>>()
        val repository = JourneyHostOfferRepository(
            loadHandler = { Result.success(HostOfferForm(id = "existing-entry", description = "A suitable room")) },
            saveHandler = { pendingSave.await() },
        )
        launch(repository)
        compose.onNodeWithText("Open hosting form").performClick()
        compose.onNodeWithText("A suitable room").assertIsDisplayed()
        compose.onNodeWithText("Hosting description").performTextReplacement("A submitted room snapshot")
        compose.onNodeWithText("Save changes").performClick()
        compose.onNodeWithText("Saving…").assertIsDisplayed()
        scenario?.recreate()

        assertEquals(1, repository.saveCalls.get())
        assertEquals("A submitted room snapshot", repository.submitted.single().description)
        pressSystemBack()
        compose.onNodeWithText("Saving…").assertIsDisplayed()

        pendingSave.complete(Result.success(hostOffer("server-returned-id")))
        compose.onNodeWithText("Hosting offer saved.").assertIsDisplayed()
        assertEquals(1, repository.saveCalls.get())
        assertEquals("existing-entry", repository.submitted.single().id)
    }

    private fun pressSystemBack() {
        compose.waitForIdle()
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun launch(repository: JourneyHostOfferRepository) {
        HostOfferNav3JourneyProvider.repository = repository
        scenario = ActivityScenario.launch(HostOfferNav3TestActivity::class.java)
    }

    private class JourneyHostOfferRepository(
        private val loadHandler: suspend (Int) -> Result<HostOfferForm> = { Result.success(HostOfferForm()) },
        private val saveHandler: suspend (Int) -> Result<AccommodationOffer> = { Result.success(hostOffer("saved-id")) },
    ) : HostOfferRepository {
        val loadCalls = AtomicInteger()
        val saveCalls = AtomicInteger()
        val submitted = CopyOnWriteArrayList<HostOfferUpdate>()

        override suspend fun load(): Result<HostOfferForm> = loadHandler(loadCalls.incrementAndGet())

        override suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer> {
            submitted += update
            return saveHandler(saveCalls.incrementAndGet())
        }
    }

}

private fun hostOffer(id: String) = AccommodationOffer(
    id = id,
    status = "yes",
    description = "A submitted room snapshot",
    noOfferDescription = "",
    maxGuests = 1,
    showOnlyInMyCircles = false,
    latitude = DEFAULT_HOST_LATITUDE,
    longitude = DEFAULT_HOST_LONGITUDE,
)
