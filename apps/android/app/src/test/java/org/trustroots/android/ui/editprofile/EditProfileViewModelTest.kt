package org.trustroots.android.ui.editprofile

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
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

        model.updateEnvironment(MobileApiClient("https://api.example.test/"), session(cookie = "new-cookie"))

        assertEquals("Draft name", model.state.value.name)
        assertEquals(0, repository.profileCalls)
        assertEquals("new-cookie", repository.latestSession?.cookieHeader)
        assertFalse(model.state.value.isSaving)
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
        var saved: ProfileUpdate? = null
        var saveCalls = 0
        var profileCalls = 0
        var latestSession: MemberSession? = null
        override fun updateApi(api: MobileApiClient): Boolean = true
        override fun updateSession(session: MemberSession): Boolean {
            latestSession = session
            return true
        }
        var saveOperation: (suspend () -> Result<MemberProfile>)? = null
        override suspend fun profile(username: String): Result<MemberProfile> {
            profileCalls++
            return profileResult
        }
        override suspend fun update(profile: ProfileUpdate): Result<MemberProfile> {
            saved = profile
            saveCalls++
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
