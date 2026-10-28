package org.trustroots.android.ui.editprofile

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
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
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileUpdate

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class EditProfileViewModelTest {
    @Test
    fun editsCanonicalFieldsAndSendsTheExistingPayload() = runBlocking {
        val repository = FakeRepository()
        val model = newModel(repository)

        assertEquals("Plain text", model.state.value.description)
        assertFalse(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.NameChanged("Updated Name"))
        model.onEvent(EditProfileEvent.LanguageToggled("fra"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.Save)

        assertEquals(
            ProfileUpdate("Updated Name", "A tagline", "Plain text", "Harbour Town", "Mountain Village", listOf("eng", "fra")),
            repository.saved,
        )
        assertEquals("Updated Name", model.state.value.pendingSave?.profile?.displayName)
        model.onEvent(EditProfileEvent.SaveDelivered(requireNotNull(model.state.value.pendingSave).id))
        assertNull(model.state.value.pendingSave)
    }

    @Test
    fun savingProfileRetainsActivityStatisticsWhenUpdateResponseOmitsThem() {
        val existingProfile = profileFixture().copy(
            lastActiveAtMillis = 1_782_920_000_000,
            replyRate = "82%",
            replyTime = "4 hours",
        )
        val repository = FakeRepository().apply {
            saveResults += Result.success(profileFixture("Updated Name"))
        }
        val model = EditProfileViewModel(
            username = "quiet-fox",
            repository = repository,
            initialApi = api(),
            initialSession = session(),
            initialProfile = existingProfile,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
        )

        model.onEvent(EditProfileEvent.NameChanged("Updated Name"))
        model.onEvent(EditProfileEvent.Save)

        val saved = requireNotNull(model.state.value.pendingSave?.profile)
        assertEquals(existingProfile.lastActiveAtMillis, saved.lastActiveAtMillis)
        assertEquals("82%", saved.replyRate)
        assertEquals("4 hours", saved.replyTime)
        assertEquals(saved, model.state.value.baseline)
    }

    @Test
    fun savingProfileUsesActivityStatisticsReturnedByUpdateResponse() {
        val existingProfile = profileFixture().copy(
            lastActiveAtMillis = 1_782_920_000_000,
            replyRate = "82%",
            replyTime = "4 hours",
        )
        val updatedProfile = profileFixture("Updated Name").copy(
            lastActiveAtMillis = 1_782_920_123_000,
            replyRate = "91%",
            replyTime = "2 hours",
        )
        val repository = FakeRepository().apply {
            saveResults += Result.success(updatedProfile)
        }
        val model = EditProfileViewModel(
            username = "quiet-fox",
            repository = repository,
            initialApi = api(),
            initialSession = session(),
            initialProfile = existingProfile,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
        )

        model.onEvent(EditProfileEvent.NameChanged("Updated Name"))
        model.onEvent(EditProfileEvent.Save)

        val saved = requireNotNull(model.state.value.pendingSave?.profile)
        assertEquals(updatedProfile.lastActiveAtMillis, saved.lastActiveAtMillis)
        assertEquals("91%", saved.replyRate)
        assertEquals("2 hours", saved.replyTime)
        assertEquals(saved, model.state.value.baseline)
    }

    @Test
    fun blankNameCannotSaveAndInFlightSavePreservesLaterEditsUntilItsEffectIsAcknowledged() {
        val repository = FakeRepository()
        val pendingResponse = CompletableDeferred<Result<MemberProfile>>()
        repository.saveOperation = { withContext(NonCancellable) { pendingResponse.await() } }
        val model = newModel(repository)

        model.onEvent(EditProfileEvent.NameChanged("   "))
        model.onEvent(EditProfileEvent.Save)
        assertEquals(0, repository.saveCalls)
        assertFalse(model.state.value.isSaving)

        model.onEvent(EditProfileEvent.NameChanged("Saved Name"))
        model.onEvent(EditProfileEvent.Save)
        model.onEvent(EditProfileEvent.Save)
        assertEquals(1, repository.saveCalls)
        assertTrue(model.state.value.isSaving)

        model.onEvent(EditProfileEvent.NameChanged("Later Draft"))
        pendingResponse.complete(Result.success(profileFixture("Saved Name")))
        val saved = requireNotNull(model.state.value.pendingSave)
        model.onEvent(EditProfileEvent.Save)
        model.onEvent(EditProfileEvent.SaveDelivered(saved.id + 1))

        assertEquals(1, repository.saveCalls)
        assertEquals(
            ProfileUpdate("Saved Name", "A tagline", "Plain text", "Harbour Town", "Mountain Village", listOf("eng")),
            repository.saved,
        )
        assertEquals(saved, model.state.value.pendingSave)
        assertEquals(profileFixture("Saved Name"), model.state.value.baseline)
        assertEquals("Later Draft", model.state.value.name)
        assertTrue(model.state.value.isDirty)

        model.onEvent(EditProfileEvent.SaveDelivered(saved.id))
        model.onEvent(EditProfileEvent.SaveDelivered(saved.id))
        assertNull(model.state.value.pendingSave)

        model.onEvent(EditProfileEvent.Save)
        assertEquals("A later save remains available after the old acknowledgement is replayed", 2, repository.saveCalls)
        assertTrue(requireNotNull(model.state.value.pendingSave).id > saved.id)
    }

    @Test
    fun dirtyStateTracksEveryCanonicalFieldAndReturnsToCleanWhenValuesAreRestored() {
        val model = newModel(FakeRepository())

        model.onEvent(EditProfileEvent.TaglineChanged("A different tagline"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.TaglineChanged("A tagline"))
        assertFalse(model.state.value.isDirty)

        model.onEvent(EditProfileEvent.DescriptionChanged("A different description"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.DescriptionChanged("Plain text"))
        assertFalse(model.state.value.isDirty)

        model.onEvent(EditProfileEvent.LivingChanged("Another Town"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.LivingChanged("Harbour Town"))
        assertFalse(model.state.value.isDirty)

        model.onEvent(EditProfileEvent.FromChanged("Another Village"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.FromChanged("Mountain Village"))
        assertFalse(model.state.value.isDirty)

        model.onEvent(EditProfileEvent.LanguageToggled("eng"))
        assertTrue(model.state.value.isDirty)
        model.onEvent(EditProfileEvent.LanguageToggled("eng"))
        assertFalse(model.state.value.isDirty)
    }

    @Test
    fun switchingToAnotherAccountClearsTheProfileDraftWithoutLoadingItForThatAccount() {
        val repository = FakeRepository()
        val model = newModel(repository)
        model.onEvent(EditProfileEvent.NameChanged("Private draft"))

        model.updateEnvironment(api(), session(username = "amber-owl", cookie = "other-account-cookie"))

        assertEquals(EditProfileUiState(isLoading = false), model.state.value)
        assertEquals(0, repository.profileCalls)
        assertEquals(0, repository.saveCalls)
    }

    @Test
    fun loadAuthenticationFailureCanBeAcknowledgedAndRetriedAfterCredentialRefresh() {
        val repository = FakeRepository().apply {
            profileResults += Result.failure(MobileApiException(401, "Fictional session expired."))
            profileResults += Result.success(profileFixture())
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = EditProfileViewModel(
                username = "quiet-fox",
                repository = repository,
                initialApi = api(),
                initialSession = session(),
                scope = scope,
            )
            val invalidation = requireNotNull(model.state.value.pendingInvalidation)

            model.onEvent(EditProfileEvent.InvalidationDelivered(invalidation.id + 1))
            assertEquals(invalidation, model.state.value.pendingInvalidation)
            model.updateEnvironment(api(), session(cookie = "refreshed-fictional-cookie"))

            assertEquals(2, repository.profileCalls)
            assertEquals("Quiet Fox", model.state.value.baseline?.displayName)
            assertNull(model.state.value.pendingInvalidation)
            model.onEvent(EditProfileEvent.InvalidationDelivered(invalidation.id))
            assertNull(model.state.value.pendingInvalidation)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun ordinaryInitialLoadFailureUsesLoadFallbackWithoutInvalidatingSession() {
        val repository = FakeRepository().apply {
            profileResults += Result.failure(IllegalStateException("Temporary profile failure"))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = EditProfileViewModel(
                username = "quiet-fox",
                repository = repository,
                initialApi = api(),
                initialSession = session(),
                scope = scope,
            )

            assertFalse(model.state.value.isLoading)
            assertEquals("LOAD_PROFILE", model.state.value.failure?.fallback?.name)
            assertNull(model.state.value.pendingInvalidation)
            assertNull(model.state.value.baseline)
            assertFalse(model.state.value.isDirty)
            model.onEvent(EditProfileEvent.Save)
            assertEquals(0, repository.saveCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun profileApiFailurePreservesUsefulServerMessageAndOmitsWhitespaceOnlyMessage() {
        val repository = FakeRepository().apply {
            profileResults += Result.failure(
                MobileApiException(503, "A fictional profile service message.", ApiFailureKind.REQUEST_REJECTED),
            )
            profileResults += Result.failure(MobileApiException(503, " \t", ApiFailureKind.REQUEST_REJECTED))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = EditProfileViewModel(
                username = "quiet-fox",
                repository = repository,
                initialApi = api(),
                initialSession = session(),
                scope = scope,
            )
            assertEquals("A fictional profile service message.", model.state.value.failure?.serverMessage)
            assertEquals(ApiFailureKind.REQUEST_REJECTED, model.state.value.failure?.apiKind)

            model.updateEnvironment(api("https://api.example.test/"), session(cookie = "refreshed-cookie"))

            assertNull(model.state.value.failure?.serverMessage)
            assertEquals(ApiFailureKind.REQUEST_REJECTED, model.state.value.failure?.apiKind)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun failureCanBeRetriedAndAuthenticationInvalidationIsAcknowledgedOnce() = runBlocking {
        val repository = FakeRepository().apply {
            saveResults += Result.failure(IllegalStateException("temporary"))
            saveResults += Result.failure(MobileApiException(401, "expired"))
        }
        val model = newModel(repository)
        model.onEvent(EditProfileEvent.NameChanged("Updated Name"))
        model.onEvent(EditProfileEvent.Save)
        assertEquals("SAVE_PROFILE", model.state.value.failure?.fallback?.name)

        model.onEvent(EditProfileEvent.Save)
        val invalidation = requireNotNull(model.state.value.pendingInvalidation)
        model.onEvent(EditProfileEvent.InvalidationDelivered(invalidation.id))
        model.onEvent(EditProfileEvent.Save)

        assertNull(model.state.value.pendingInvalidation)
        assertEquals(2, repository.saveCalls)

        repository.saveResults += Result.success(profileFixture("Updated Name"))
        model.updateEnvironment(api(), session(cookie = "rotated-cookie"))
        assertEquals("Updated Name", model.state.value.name)
        model.onEvent(EditProfileEvent.Save)
        assertEquals(3, repository.saveCalls)
        assertEquals("Updated Name", model.state.value.pendingSave?.profile?.displayName)
    }

    @Test
    fun sameBackendClientAndSessionRotationKeepDraftWithoutReloadingProfile() {
        val repository = FakeRepository()
        val model = newModel(repository)
        model.onEvent(EditProfileEvent.NameChanged("Draft name"))

        model.updateEnvironment(api(), session())

        assertEquals("Draft name", model.state.value.name)
        assertEquals(0, repository.profileCalls)

        model.updateEnvironment(MobileApiClient("https://api.example.test/"), session(cookie = "new-cookie"))

        assertEquals("Draft name", model.state.value.name)
        assertEquals(0, repository.profileCalls)
        assertEquals("new-cookie", repository.latestSession?.cookieHeader)
        assertFalse(model.state.value.isSaving)
    }

    @Test
    fun credentialRefreshCancelsPendingSaveWithoutReplacingLaterDraftOrBaseline() {
        val pending = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeRepository().apply {
            saveOperation = { withContext(NonCancellable) { pending.await() } }
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = EditProfileViewModel(
                username = "quiet-fox",
                repository = repository,
                initialApi = api(),
                initialSession = session(),
                initialProfile = profileFixture(),
                scope = scope,
            )
            model.onEvent(EditProfileEvent.NameChanged("Submitted Name"))
            model.onEvent(EditProfileEvent.Save)
            model.onEvent(EditProfileEvent.NameChanged("Later Draft"))
            assertTrue(model.state.value.isSaving)

            model.updateEnvironment(api(), session(cookie = "rotated-fictional-cookie"))
            pending.complete(Result.success(profileFixture("Submitted Name")))

            assertFalse(model.state.value.isSaving)
            assertEquals("Quiet Fox", model.state.value.baseline?.displayName)
            assertEquals("Later Draft", model.state.value.name)
            assertTrue(model.state.value.isDirty)
            assertNull(model.state.value.pendingSave)
            assertEquals(1, repository.saveCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun backendRefreshDuringSaveKeepsFreshProfileWhenOldSuccessReturnsInline() {
        val repository = FakeRepository().apply {
            profileResult = Result.success(profileFixture("Fresh Backend Profile"))
            saveResults += Result.success(profileFixture("Old Save Response"))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        lateinit var model: EditProfileViewModel
        repository.beforeSaveResult = {
            model.updateEnvironment(api("https://other.example.test/"), session())
        }
        try {
            model = EditProfileViewModel(
                username = "quiet-fox",
                repository = repository,
                initialApi = api(),
                initialSession = session(),
                initialProfile = profileFixture(),
                scope = scope,
            )
            model.onEvent(EditProfileEvent.NameChanged("Submitted Name"))
            model.onEvent(EditProfileEvent.Save)

            assertEquals("Fresh Backend Profile", model.state.value.baseline?.displayName)
            assertEquals("Fresh Backend Profile", model.state.value.name)
            assertNull(model.state.value.pendingSave)
            assertFalse(model.state.value.isSaving)
            assertEquals(1, repository.profileCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun credentialRefreshDuringRetryIgnoresOldAuthenticationFailureBeforeLaunchReturns() {
        val repository = FakeRepository().apply {
            saveResults += Result.failure(IllegalStateException("Temporary save failure"))
            saveResults += Result.failure(MobileApiException(401, "Fictional stale session."))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val model = EditProfileViewModel(
            username = "quiet-fox",
            repository = repository,
            initialApi = api(),
            initialSession = session(),
            initialProfile = profileFixture(),
            scope = scope,
        )
        try {
            model.onEvent(EditProfileEvent.NameChanged("Submitted Name"))
            model.onEvent(EditProfileEvent.Save)
            assertEquals("SAVE_PROFILE", model.state.value.failure?.fallback?.name)

            repository.beforeSaveResult = {
                model.updateEnvironment(api(), session(cookie = "rotated-fictional-cookie"))
            }
            model.onEvent(EditProfileEvent.Save)

            assertNull(model.state.value.pendingInvalidation)
            assertNull(model.state.value.failure)
            assertFalse(model.state.value.isSaving)
            assertEquals("Submitted Name", model.state.value.name)
            assertEquals(2, repository.saveCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun backendChangeReloadsACleanCanonicalBaseline() {
        val repository = FakeRepository()
        val model = newModel(repository)
        model.onEvent(EditProfileEvent.NameChanged("Old backend draft"))

        model.updateEnvironment(api("https://other.example.test/"), session())

        assertEquals("Quiet Fox", model.state.value.name)
        assertFalse(model.state.value.isDirty)
        assertEquals(1, repository.profileCalls)
    }

    @Test
    fun mobileRepositoryDetectsBackendCookieAndAccountIdentityChanges() {
        val originalSession = session()
        val repository = MobileApiEditProfileRepository(api(), originalSession)

        assertFalse(repository.updateApi(api("https://api.example.test")))
        assertTrue(repository.updateApi(api("https://other.example.test")))
        assertFalse(repository.updateSession(originalSession))
        assertTrue(repository.updateSession(session(cookie = "refreshed-fictional-cookie")))
        assertTrue(repository.updateSession(session(username = "calm-lynx", cookie = "refreshed-fictional-cookie")))
        assertFalse(repository.updateSession(session(username = "calm-lynx", cookie = "refreshed-fictional-cookie")))
    }

    @Test
    fun accountOrBackendChangeClearsTheOldFormAndRejectsLateAuthenticationFailure() {
        val pending = kotlinx.coroutines.CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeRepository().apply { saveOperation = { pending.await() } }
        val model = newModel(repository)
        model.onEvent(EditProfileEvent.NameChanged("Private draft"))
        model.onEvent(EditProfileEvent.Save)
        assertTrue(model.state.value.isSaving)

        model.updateEnvironment(api(), session(username = "new-member"))
        pending.complete(Result.failure(MobileApiException(401, "expired old session")))

        assertNull(model.state.value.baseline)
        assertEquals("", model.state.value.name)
        assertNull(model.state.value.pendingInvalidation)
        assertEquals(0, repository.profileCalls)
        assertFalse(model.state.value.isSaving)
    }

    @Test
    fun actualEntryStoresRetainAndIsolateSameUsernameEdits() {
        val firstStore = ViewModelStore()
        val secondStore = ViewModelStore()
        val first = entryModel(firstStore, "First")
        val second = entryModel(secondStore, "Second")
        first.onEvent(EditProfileEvent.NameChanged("First draft"))
        second.onEvent(EditProfileEvent.NameChanged("Second draft"))

        assertEquals("First draft", first.state.value.name)
        assertEquals("Second draft", second.state.value.name)
        firstStore.clear()
        assertEquals("Second draft", second.state.value.name)
        secondStore.clear()
    }

    @Test
    fun removingAnEntryCancelsItsPendingLoadAndRejectsLateResult() {
        val pending = kotlinx.coroutines.CompletableDeferred<Result<MemberProfile>>()
        val repository = object : EditProfileRepository {
            override suspend fun profile(username: String) = pending.await()
            override suspend fun update(update: ProfileUpdate) = Result.success(profileFixture())
        }
        val store = ViewModelStore()
        val model = ViewModelProvider(
            Owner(store),
            EditProfileViewModel.Factory(
                "quiet-fox", repository,
                api(),
                session(),
                scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
            ),
        )["EditProfileViewModel:quiet-fox", EditProfileViewModel::class.java]

        store.clear()
        pending.complete(Result.success(profileFixture("Late result")))

        assertNull(model.state.value.baseline)
        assertFalse(model.state.value.isLoading)
    }

    private fun newModel(repository: FakeRepository) = EditProfileViewModel(
        username = "quiet-fox",
        repository = repository,
        initialApi = api(),
        initialSession = session(),
        initialProfile = profileFixture(),
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
    )

    private fun entryModel(store: ViewModelStore, name: String) = ViewModelProvider(
        Owner(store),
        EditProfileViewModel.Factory(
            "quiet-fox",
            FakeRepository().apply { profileResult = Result.success(profileFixture(name)) },
            api(),
            session(),
            profileFixture(name),
        ),
    )["EditProfileViewModel:quiet-fox", EditProfileViewModel::class.java]

    private class Owner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class FakeRepository : EditProfileRepository {
        var profileResult: Result<MemberProfile> = Result.success(profileFixture())
        val saveResults = ArrayDeque<Result<MemberProfile>>()
        val profileResults = ArrayDeque<Result<MemberProfile>>()
        var saved: ProfileUpdate? = null
        var saveCalls = 0
        var profileCalls = 0
        var latestSession: MemberSession? = null
        var beforeSaveResult: (() -> Unit)? = null
        override fun updateApi(api: MobileApiClient): Boolean = true
        override fun updateSession(session: MemberSession): Boolean {
            latestSession = session
            return true
        }
        var saveOperation: (suspend () -> Result<MemberProfile>)? = null
        override suspend fun profile(username: String): Result<MemberProfile> {
            profileCalls++
            return if (profileResults.isEmpty()) profileResult else profileResults.removeFirst()
        }
        override suspend fun update(profile: ProfileUpdate): Result<MemberProfile> {
            saved = profile
            saveCalls++
            beforeSaveResult?.also {
                beforeSaveResult = null
                it()
            }
            saveOperation?.let { return it() }
            return if (saveResults.isEmpty()) Result.success(profileFixture(profile.displayName)) else saveResults.removeFirst()
        }
    }

    private companion object {
        fun api(baseURL: String = "https://api.example.test/") = MobileApiClient(baseURL)
        fun session(username: String = "quiet-fox", cookie: String = "session-cookie") =
            MemberSession(cookie, MobileMember(username, "Quiet Fox"))

        fun profileFixture(name: String = "Quiet Fox") = MemberProfile(
            id = "member-fox", username = "quiet-fox", displayName = name, tagline = "A tagline",
            description = "<p>Plain text</p>", location = null, locationLiving = "Harbour Town",
            locationFrom = "Mountain Village", languages = listOf("eng"),
        )
    }
}
