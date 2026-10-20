package org.trustroots.android.ui.profile

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
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
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import java.io.IOException
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberProfileViewModelTest {
    @Test
    fun loadsProfileAndRelatedSectionsIntoImmutableEntryState() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(model.state.value.hostingLoaded)
        assertEquals("offer-fox", model.state.value.hosting?.id)
        assertEquals(listOf("steady-owl"), model.state.value.contacts.map { it.user.username })
        assertEquals(listOf("reference-owl"), model.state.value.references.map { it.author.username })
        assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun separateNavigationEntryStoresIsolateRepeatedUsernameVisitsAndClearOnRemoval() {
        val firstStore = ViewModelStore()
        val secondStore = ViewModelStore()
        val firstRepository = FakeMemberProfileRepository()
        val secondRepository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Second Visit"))
        }
        val first = ViewModelProvider(Owner(firstStore), MemberProfileViewModel.Factory(
            "quiet-fox", "member-self", firstRepository,
        ))["MemberProfileViewModel:quiet-fox", MemberProfileViewModel::class.java]
        val second = ViewModelProvider(Owner(secondStore), MemberProfileViewModel.Factory(
            "quiet-fox", "member-self", secondRepository,
        ))["MemberProfileViewModel:quiet-fox", MemberProfileViewModel::class.java]

        assertEquals("Quiet Fox", first.state.value.profile?.displayName)
        assertEquals("Second Visit", second.state.value.profile?.displayName)
        firstStore.clear()

        assertNull(first.state.value.profile)
        assertEquals("Second Visit", second.state.value.profile?.displayName)
        secondStore.clear()
        assertNull(second.state.value.profile)
    }

    @Test
    fun authenticationFailureIsDeliveredOnce() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.failure(MobileApiException(401, "Expired"))
        }
        val model = newModel("quiet-fox", repository)
        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)

        model.onEvent(MemberProfileEvent.SessionInvalidationDelivered(pending.id))

        assertNull(model.state.value.pendingSessionInvalidation)
        assertFalse(model.state.value.isLoading)
        assertTrue(model.state.value.profile == null)
    }

    @Test
    fun hostingAuthenticationFailureCompletesSectionAndPreservesProfile() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        val model = newModel("quiet-fox", repository)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(model.state.value.hostingLoaded)
        assertNull(model.state.value.hosting)
        assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun renewedCredentialsCancelOldLoadAndIgnoreItsLateProfile() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val oldProfile = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeMemberProfileRepository().apply {
            profileHandler = {
                if (profileCalls == 1) withContext(NonCancellable) { oldProfile.await() }
                else Result.success(profile("quiet-fox", "Renewed Profile"))
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            assertTrue(model.state.value.isLoading)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:1"),
                MemberSession("connect.sid=renewed-fictional-session", MobileMember("quiet-fox", "Quiet Fox")),
            )

            assertEquals("connect.sid=renewed-fictional-session", repository.currentCookie)
            assertEquals("Renewed Profile", model.state.value.profile?.displayName)
            oldProfile.complete(Result.success(profile("quiet-fox", "Stale Profile")))

            assertEquals("Renewed Profile", model.state.value.profile?.displayName)
            assertEquals(2, repository.profileCalls)
            assertEquals("Renewed own username is used when deciding whether to load a relationship", 0, repository.relationshipCalls)
            assertFalse(model.state.value.toString().contains("renewed-fictional-session"))
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun recreatedClientForSameBackendKeepsLoadedEntryState() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)
        val recreatedClient = MobileApiClient("http://127.0.0.1:1")

        model.updateEnvironment(
            recreatedClient,
            MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self")),
        )

        assertSame(recreatedClient, repository.currentApi)
        assertEquals(1, repository.profileCalls)
        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(model.state.value.hostingLoaded)
    }

    @Test
    fun repositoryDistinguishesBackendChangeFromNewClientInstance() {
        val session = MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self"))
        val repository = MobileApiMemberProfileRepository(
            MobileApiClient("http://127.0.0.1:1"), session,
        )

        assertFalse(repository.updateApi(MobileApiClient("http://127.0.0.1:1")))
        assertTrue(repository.updateApi(MobileApiClient("http://127.0.0.1:2")))
    }

    @Test
    fun authenticationLatchRejectsProfileAndContactMutations() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        val model = newModel("quiet-fox", repository)

        model.onEvent(MemberProfileEvent.ProfileSaved(profile("quiet-fox", "Unsaved Change")))
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertTrue(repository.removedContactIDs.isEmpty())
        assertTrue(model.state.value.hostingLoaded)
        assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
    }

    @Test
    fun nonAuthenticationRelationshipFailureLeavesProfileUsable() {
        val repository = FakeMemberProfileRepository().apply {
            relationshipResult = Result.failure(IOException("Temporary relationship failure"))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals("Quiet Fox", state.profile?.displayName)
        assertTrue(state.relationshipResolved)
        assertNull(state.relationship)
        assertNull(state.failure)
    }

    @Test
    fun confirmingContactRemovalUpdatesTheRelationshipWithoutReloadingTheProfile() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)

        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals(listOf("relationship-fox"), repository.removedContactIDs)
        assertEquals(ContactRelationship(null, false), model.state.value.relationship)
        assertTrue(model.state.value.contactRemovalSucceeded)
        assertFalse(model.state.value.isRemovingContact)
    }

    private fun newModel(
        username: String,
        repository: FakeMemberProfileRepository,
        scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
    ) = MemberProfileViewModel(
        username = username,
        ownUsername = "member-self",
        repository = repository,
        scope = scope,
    )

    private class Owner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class FakeMemberProfileRepository : MemberProfileRepository {
        val removedContactIDs = mutableListOf<String>()
        var profileResult: Result<MemberProfile> = Result.success(profile("quiet-fox", "Quiet Fox"))
        var profileHandler: (suspend (String) -> Result<MemberProfile>)? = null
        var profileCalls = 0
        var currentCookie: String? = "connect.sid=fictional-session"
        var currentApi: MobileApiClient? = null
        var hostingResult: Result<AccommodationOffer?> = Result.success(AccommodationOffer("offer-fox", "yes", "A home", null, 2))
        var relationshipResult: Result<ContactRelationship> = Result.success(ContactRelationship("relationship-fox", true))
        var relationshipCalls = 0
        override fun updateApi(api: MobileApiClient): Boolean {
            currentApi = api
            return false
        }
        override fun updateSession(session: MemberSession): Boolean {
            val changed = currentCookie != session.cookieHeader
            currentCookie = session.cookieHeader
            return changed
        }
        override suspend fun profile(username: String): Result<MemberProfile> {
            profileCalls++
            val handler = profileHandler ?: { _: String -> profileResult }
            return handler(username)
        }
        override suspend fun hosting(memberID: String) = hostingResult
        override suspend fun contacts(memberID: String) = Result.success(listOf(ProfileContact("contact-owl", org.trustroots.android.api.MessageMember("owl-id", "steady-owl", "Steady Owl"))))
        override suspend fun references(memberID: String) = Result.success(listOf(ProfileReference("reference-one", org.trustroots.android.api.MessageMember("ref-id", "reference-owl", "Reference Owl"), "A kind visit", "yes", null)))
        override suspend fun relationship(memberID: String): Result<ContactRelationship> {
            relationshipCalls++
            return relationshipResult
        }
        override suspend fun removeContact(contactID: String): Result<Unit> {
            removedContactIDs += contactID
            return Result.success(Unit)
        }
    }

    private companion object {
        fun profile(username: String, displayName: String) = MemberProfile(
            id = "member-$username", username = username, displayName = displayName,
            tagline = null, description = null, location = null, languages = emptyList(),
        )
    }
}
