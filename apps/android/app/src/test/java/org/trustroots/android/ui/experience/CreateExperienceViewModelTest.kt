package org.trustroots.android.ui.experience

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
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
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CreateExperienceViewModelTest {
    @Test
    fun mobileRepositoryTracksBackendCookieAndAccountIdentity() {
        val api = api()
        val original = session(cookie = "connect.sid=old")
        val repository = MobileApiCreateExperienceRepository(api, original)

        assertFalse(repository.updateApi(api()))
        assertTrue(repository.updateApi(MobileApiClient("https://other.example.test")))
        assertFalse(repository.updateSession(original))
        assertTrue(repository.updateSession(session(cookie = "connect.sid=new")))
        assertTrue(repository.updateSession(session(username = "amber-owl", cookie = "connect.sid=new")))
        assertFalse(repository.updateSession(session(username = "amber-owl", cookie = "connect.sid=new")))
    }

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
        assertEquals(1, repository.calls)
        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals("A pending success must not submit a duplicate experience", 1, repository.calls)
        val success = requireNotNull(model.state.value.pendingSuccess)
        model.onEvent(CreateExperienceEvent.SuccessDelivered(success.id + 1))
        assertEquals(success, model.state.value.pendingSuccess)
        model.onEvent(CreateExperienceEvent.SuccessDelivered(success.id))
        model.onEvent(CreateExperienceEvent.SuccessDelivered(success.id))
        assertNull(model.state.value.pendingSuccess)

        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals("A later submission remains available after the old acknowledgement is replayed", 2, repository.calls)
        assertTrue(requireNotNull(model.state.value.pendingSuccess).id > success.id)
    }

    @Test
    fun submissionRequiresAtLeastOnePositiveExperienceAnswer() {
        val repository = FakeRepository()
        val model = newModel(repository)

        model.onEvent(CreateExperienceEvent.MetChanged(false))
        assertFalse(model.state.value.canSave)
        assertTrue(model.state.value.isDirty)
        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(0, repository.calls)
        assertFalse(model.state.value.isSaving)

        model.onEvent(CreateExperienceEvent.WasGuestChanged(true))
        assertTrue(model.state.value.canSave)
        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(1, repository.calls)
    }

    @Test
    fun recommendationAndFeedbackDraftsAreDirtyButDoNotReplaceTheExperienceEligibilityAnswers() {
        val repository = FakeRepository()
        val model = newModel(repository)
        model.onEvent(CreateExperienceEvent.MetChanged(false))
        model.onEvent(CreateExperienceEvent.RecommendationChanged("no"))
        model.onEvent(CreateExperienceEvent.FeedbackChanged("A fictional note"))

        assertTrue(model.state.value.isDirty)
        assertFalse(model.state.value.canSave)
        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(0, repository.calls)

        model.onEvent(CreateExperienceEvent.HostedChanged(true))
        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals("no", repository.created?.recommend)
        assertEquals("A fictional note", repository.created?.feedbackPublic)
        assertEquals(1, repository.calls)
    }

    @Test
    fun recommendationAndFeedbackAloneMakeAMetExperienceDirty() {
        val model = newModel(FakeRepository())

        model.onEvent(CreateExperienceEvent.RecommendationChanged("no"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(CreateExperienceEvent.RecommendationChanged("yes"))
        assertFalse(model.state.value.isDirty)

        model.onEvent(CreateExperienceEvent.FeedbackChanged("A fictional note"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(CreateExperienceEvent.FeedbackChanged(""))
        assertFalse(model.state.value.isDirty)
    }

    @Test
    fun eachPositiveExperienceAnswerIndependentlyAllowsSubmission() {
        val positiveAnswers = listOf(
            CreateExperienceEvent.MetChanged(true) to Triple(true, false, false),
            CreateExperienceEvent.HostedChanged(true) to Triple(false, true, false),
            CreateExperienceEvent.WasGuestChanged(true) to Triple(false, false, true),
        )

        positiveAnswers.forEach { (positiveAnswer, expected) ->
            val repository = FakeRepository()
            val model = newModel(repository)
            model.onEvent(CreateExperienceEvent.MetChanged(false))
            model.onEvent(CreateExperienceEvent.HostedChanged(false))
            model.onEvent(CreateExperienceEvent.WasGuestChanged(false))
            assertFalse(model.state.value.canSave)

            model.onEvent(positiveAnswer)

            assertTrue(model.state.value.canSave)
            model.onEvent(CreateExperienceEvent.Submit)
            assertEquals(1, repository.calls)
            assertEquals(expected.first, repository.created?.met)
            assertEquals(expected.second, repository.created?.host)
            assertEquals(expected.third, repository.created?.guest)
        }
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
    fun serverValidationFailureIsExposedAndThrownRepositoryErrorsSettleTheForm() {
        val repository = FakeRepository().apply {
            result = Result.failure(
                MobileApiException(
                    422,
                    "  A fictional validation response.  ",
                    ApiFailureKind.REQUEST_REJECTED,
                ),
            )
        }
        val model = newModel(repository)

        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, model.state.value.failure?.apiKind)
        assertEquals("  A fictional validation response.  ", model.state.value.failure?.serverMessage)
        assertFalse(model.state.value.isSaving)

        repository.result = Result.success(Unit)
        repository.throwOnCreate = true
        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(CreateExperienceFailure(), model.state.value.failure)
        assertFalse(model.state.value.isSaving)

        repository.throwOnCreate = false
        repository.result = Result.failure(MobileApiException(422, " \t ", ApiFailureKind.REQUEST_REJECTED))
        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(ApiFailureKind.REQUEST_REJECTED, model.state.value.failure?.apiKind)
        assertNull(model.state.value.failure?.serverMessage)
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
    fun credentialRotationRejectsLateSuccessAndKeepsAnswersForAnExplicitRetry() {
        val pending = CompletableDeferred<Result<Unit>>()
        val submissions = mutableListOf<ExperienceCreate>()
        val repository = CreateExperienceRepository { experience ->
            submissions += experience
            if (submissions.size == 1) withContext(NonCancellable) { pending.await() }
            else Result.success(Unit)
        }
        val model = newModel(repository)
        model.onEvent(CreateExperienceEvent.HostedChanged(true))
        model.onEvent(CreateExperienceEvent.FeedbackChanged("A retained fictional answer"))
        val submitted = ExperienceCreate("member-owl", true, false, true, "yes", "A retained fictional answer")
        model.onEvent(CreateExperienceEvent.Submit)

        model.updateEnvironment(MobileApiClient("https://api.example.test/"), session(cookie = "renewed-cookie"))
        pending.complete(Result.success(Unit))

        assertEquals(listOf(submitted), submissions)
        assertFalse(model.state.value.isSaving)
        assertNull(model.state.value.pendingSuccess)
        assertEquals("A retained fictional answer", model.state.value.feedback)
        assertTrue(model.state.value.isDirty)

        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(2, submissions.size)
        assertEquals(submitted, submissions.last())
        assertTrue(model.state.value.pendingSuccess != null)
    }

    @Test
    fun reentrantCredentialRotationRejectsOldAuthenticationFailure() = withScope { scope ->
        lateinit var model: CreateExperienceViewModel
        var calls = 0
        val client = api()
        val oldSession = session(cookie = "old-cookie")
        val newSession = session(cookie = "rotated-cookie")
        val repository = CreateExperienceRepository {
            calls++
            if (calls == 1) {
                // Unconfined launch executes this before submit stores requestJob.
                model.updateEnvironment(client, newSession)
                Result.failure(MobileApiException(401, "Expired old request"))
            } else Result.success(Unit)
        }
        model = CreateExperienceViewModel(
            memberID = "member-owl",
            repository = repository,
            initialApi = client,
            initialSession = oldSession,
            scope = scope,
        )
        model.onEvent(CreateExperienceEvent.FeedbackChanged("A retained fictional draft"))

        model.onEvent(CreateExperienceEvent.Submit)

        assertEquals(1, calls)
        assertNull(model.state.value.pendingInvalidation)
        assertNull(model.state.value.failure)
        assertFalse(model.state.value.isSaving)
        assertEquals("A retained fictional draft", model.state.value.feedback)
        assertTrue(model.state.value.isDirty)

        model.onEvent(CreateExperienceEvent.Submit)
        assertEquals(2, calls)
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
        model.onEvent(CreateExperienceEvent.InvalidationDelivered(invalidation.id + 1))
        assertEquals(invalidation, model.state.value.pendingInvalidation)
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
    fun accountOnlyChangeCancelsTheOldAccountCreateAndClearsItsDraft() {
        val pending = CompletableDeferred<Result<Unit>>()
        val submissions = mutableListOf<ExperienceCreate>()
        val repository = CreateExperienceRepository { experience ->
            submissions += experience
            withContext(NonCancellable) { pending.await() }
        }
        val model = newModel(repository)
        model.onEvent(CreateExperienceEvent.FeedbackChanged("A private fictional draft"))
        model.onEvent(CreateExperienceEvent.Submit)

        model.updateEnvironment(api(), session(username = "amber-owl"))
        assertEquals(CreateExperienceUiState(), model.state.value)
        pending.complete(Result.success(Unit))

        assertEquals(1, submissions.size)
        assertEquals(CreateExperienceUiState(), model.state.value)
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

    private fun withScope(block: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            block(scope)
        } finally {
            scope.cancel()
        }
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
            if (throwOnCreate) throw IllegalStateException("A fictional repository failure.")
            return result
        }

        var throwOnCreate = false
    }

    private class Owner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private companion object {
        fun api() = MobileApiClient("https://api.example.test/")
        fun session(username: String = "quiet-fox", cookie: String = "session-cookie") =
            MemberSession(cookie, MobileMember(username, "Quiet Fox"))
    }
}
