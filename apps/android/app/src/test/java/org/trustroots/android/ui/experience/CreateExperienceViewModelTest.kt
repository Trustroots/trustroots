package org.trustroots.android.ui.experience

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.ExperienceCreate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CreateExperienceViewModelTest {
    @Test
    fun preservesDefaultsAndSendsExistingExperiencePayload() {
        val repository = FakeRepository()
        val model = newModel(repository)

        assertTrue(model.state.value.canSave)
        assertFalse(model.state.value.isDirty)
        model.onEvent(CreateExperienceEvent.HostedChanged(true))
        model.onEvent(CreateExperienceEvent.WasGuestChanged(true))
        model.onEvent(CreateExperienceEvent.RecommendationChanged("unknown"))
        model.onEvent(CreateExperienceEvent.FeedbackChanged("A kind visit"))
        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(ExperienceCreate("member-owl", true, true, true, "unknown", "A kind visit"), repository.created)
        val success = requireNotNull(model.state.value.pendingSuccess)
        model.onEvent(CreateExperienceEvent.SuccessDelivered(success.id))
        assertNull(model.state.value.pendingSuccess)
    }

    @Test
    fun duplicateSubmitIsIgnoredUntilFailureCanBeRetried() {
        val deferred = CompletableDeferred<Result<Unit>>()
        val calls = mutableListOf<ExperienceCreate>()
        val repository = CreateExperienceRepository { create ->
            calls += create
            if (calls.size == 1) deferred.await() else Result.failure(IllegalStateException("temporary"))
        }
        val model = newModel(repository)

        model.onEvent(CreateExperienceEvent.Submit)
        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(1, calls.size)
        deferred.complete(Result.failure(IllegalStateException("retry")))
        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(2, calls.size)
        assertTrue(model.state.value.failure != null)
        assertFalse(model.state.value.isSaving)
    }

    @Test
    fun replacingClientForSameBackendDoesNotRepeatAnInFlightCreation() {
        val pending = CompletableDeferred<Result<Unit>>()
        var calls = 0
        val repository = CreateExperienceRepository {
            calls++
            pending.await()
        }
        val model = newModel(repository)

        model.onEvent(CreateExperienceEvent.Submit)
        model.updateEnvironment(MobileApiClient("https://api.example.test/"), session())
        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(1, calls)
        pending.complete(Result.success(Unit))
        assertTrue(model.state.value.pendingSuccess != null)
    }

    @Test
    fun authenticationInvalidationIsDeliveredOnce() {
        val repository = FakeRepository().apply {
            result = Result.failure(MobileApiException(401, "expired"))
        }
        val model = newModel(repository)
        model.onEvent(CreateExperienceEvent.FeedbackChanged("Retained draft"))

        model.onEvent(CreateExperienceEvent.Submit)
        val invalidation = requireNotNull(model.state.value.pendingInvalidation)
        model.onEvent(CreateExperienceEvent.InvalidationDelivered(invalidation.id))
        model.onEvent(CreateExperienceEvent.Submit)

        assertNull(model.state.value.pendingInvalidation)
        assertEquals(1, repository.calls)

        repository.result = Result.success(Unit)
        model.updateEnvironment(MobileApiClient("https://api.example.test/"), session(cookie = "renewed"))
        assertEquals("Retained draft", model.state.value.feedback)
        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(2, repository.calls)
        assertTrue(model.state.value.pendingSuccess != null)
    }

    @Test
    fun accountOrBackendChangeClearsDraftAndDoesNotResubmitAnInFlightCreate() {
        val pending = CompletableDeferred<Result<Unit>>()
        var calls = 0
        val repository = CreateExperienceRepository {
            calls++
            pending.await()
        }
        val model = newModel(repository)
        model.onEvent(CreateExperienceEvent.FeedbackChanged("Private draft"))
        model.onEvent(CreateExperienceEvent.Submit)

        model.updateEnvironment(MobileApiClient("https://other.example.test/"), session(username = "new-member"))
        pending.complete(Result.failure(MobileApiException(401, "expired old session")))

        assertEquals(1, calls)
        assertEquals("", model.state.value.feedback)
        assertFalse(model.state.value.isSaving)
        assertNull(model.state.value.pendingInvalidation)
        assertNull(model.state.value.pendingSuccess)
    }

    @Test
    fun removingTheExperienceEntryCancelsItsPendingSubmission() {
        val pending = CompletableDeferred<Result<Unit>>()
        var calls = 0
        val repository = CreateExperienceRepository {
            calls++
            pending.await()
        }
        val store = ViewModelStore()
        val model = ViewModelProvider(
            Owner(store),
            CreateExperienceViewModel.Factory(
                "member-owl", repository, api(), session(),
                CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
            ),
        )["CreateExperienceViewModel:member-owl", CreateExperienceViewModel::class.java]

        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(1, calls)
        store.clear()
        pending.complete(Result.success(Unit))

        assertNull(model.state.value.pendingSuccess)
        assertFalse(model.state.value.isSaving)
    }

    private fun newModel(repository: CreateExperienceRepository) = CreateExperienceViewModel(
        memberID = "member-owl",
        repository = repository,
        initialApi = api(),
        initialSession = session(),
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
    )

    private class FakeRepository : CreateExperienceRepository {
        var result: Result<Unit> = Result.success(Unit)
        var created: ExperienceCreate? = null
        var calls = 0
        override suspend fun create(experience: ExperienceCreate): Result<Unit> {
            created = experience
            calls++
            return result
        }
    }

    private class Owner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private companion object {
        fun api() = MobileApiClient("https://api.example.test/")
        fun session(username: String = "quiet-fox", cookie: String = "session-cookie") =
            MemberSession(cookie, MobileMember(username, "Quiet Fox"))
    }
}
