package org.trustroots.android.ui.editprofile

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
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.ProfileUpdate

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class EditProfileBranchContractsTest {
    @Test
    fun switchingAwayAndBackClearsPrivateDraftThenReloadsTheOwnedProfile() {
        val repository = BranchRepository()
        val model = model(repository)
        model.onEvent(EditProfileEvent.NameChanged("Private draft"))

        model.updateEnvironment(api(), session(username = "other-member"))
        assertEquals(EditProfileUiState(isLoading = false), model.state.value)
        assertEquals(0, repository.profileCalls)

        repository.profileResult = Result.success(memberProfile("Reloaded profile"))
        model.updateEnvironment(api(), session())

        assertEquals(1, repository.profileCalls)
        assertEquals("Reloaded profile", model.state.value.name)
        assertFalse(model.state.value.isDirty)
    }

    @Test
    fun aLateLoadFromThePreviousBackendCannotReplaceTheNewBackendProfile() = runBlocking {
        val oldLoad = CompletableDeferred<Result<MemberProfile>>()
        val repository = BranchRepository().apply {
            profileOperation = { call ->
                if (call == 1) withContext(NonCancellable) { oldLoad.await() }
                else Result.success(memberProfile("Current backend"))
            }
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = model(repository, scope = scope, initialProfile = null)
            assertTrue(model.state.value.isLoading)

            model.updateEnvironment(api("https://next.example.test/"), session())
            assertEquals("Current backend", model.state.value.name)
            oldLoad.complete(Result.success(memberProfile("Previous backend")))

            assertEquals("Current backend", model.state.value.name)
            assertEquals(2, repository.profileCalls)
            assertFalse(model.state.value.isLoading)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun aStaleOrdinarySaveFailureCannotOverwriteStateAfterCredentialRefresh() = runBlocking {
        val oldSave = CompletableDeferred<Result<MemberProfile>>()
        val repository = BranchRepository().apply {
            updateOperation = { withContext(NonCancellable) { oldSave.await() } }
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = model(repository, scope = scope)
            model.onEvent(EditProfileEvent.NameChanged("Submitted draft"))
            model.onEvent(EditProfileEvent.Save)
            model.onEvent(EditProfileEvent.NameChanged("New credential draft"))
            assertTrue(model.state.value.isSaving)

            model.updateEnvironment(api(), session(cookie = "rotated-cookie"))
            oldSave.complete(Result.failure(IllegalStateException("Old request failed")))

            assertFalse(model.state.value.isSaving)
            assertNull(model.state.value.failure)
            assertNull(model.state.value.pendingInvalidation)
            assertEquals("Quiet Fox", model.state.value.baseline?.displayName)
            assertEquals("New credential draft", model.state.value.name)
            assertTrue(model.state.value.isDirty)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun aPendingSaveEffectBlocksAnotherSubmissionUntilTheEffectIsDelivered() {
        val repository = BranchRepository()
        val model = model(repository)
        model.onEvent(EditProfileEvent.NameChanged("Saved draft"))
        model.onEvent(EditProfileEvent.Save)
        val pendingSave = requireNotNull(model.state.value.pendingSave)

        model.onEvent(EditProfileEvent.NameChanged("Next draft"))
        model.onEvent(EditProfileEvent.Save)

        assertEquals(1, repository.updateCalls)
        assertEquals(pendingSave, model.state.value.pendingSave)
        assertEquals("Next draft", model.state.value.name)

        model.onEvent(EditProfileEvent.SaveDelivered(pendingSave.id))
        model.onEvent(EditProfileEvent.Save)
        assertEquals(2, repository.updateCalls)
        assertEquals("Next draft", model.state.value.pendingSave?.profile?.displayName)
    }

    private fun model(
        repository: BranchRepository,
        scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
        initialProfile: MemberProfile? = memberProfile(),
    ) = EditProfileViewModel(
        username = "quiet-fox",
        repository = repository,
        initialApi = api(),
        initialSession = session(),
        initialProfile = initialProfile,
        scope = scope,
    )

    private class BranchRepository : EditProfileRepository {
        var profileCalls = 0
        var updateCalls = 0
        var profileResult: Result<MemberProfile> = Result.success(memberProfile())
        var profileOperation: (suspend (Int) -> Result<MemberProfile>)? = null
        var updateOperation: (suspend () -> Result<MemberProfile>)? = null

        override suspend fun profile(username: String): Result<MemberProfile> {
            profileCalls++
            return profileOperation?.invoke(profileCalls) ?: profileResult
        }

        override suspend fun update(profile: ProfileUpdate): Result<MemberProfile> {
            updateCalls++
            return updateOperation?.invoke() ?: Result.success(memberProfile(profile.displayName))
        }
    }

    private companion object {
        fun api(url: String = "https://api.example.test/") = MobileApiClient(url)
        fun session(username: String = "quiet-fox", cookie: String = "fictional-cookie") =
            MemberSession(cookie, MobileMember(username, "Quiet Fox"))

        fun memberProfile(name: String = "Quiet Fox") = MemberProfile(
            id = "member-fox",
            username = "quiet-fox",
            displayName = name,
            tagline = "A tagline",
            description = "<p>Plain text</p>",
            location = null,
            locationLiving = "Harbour Town",
            locationFrom = "Mountain Village",
            languages = listOf("eng"),
        )
    }
}
