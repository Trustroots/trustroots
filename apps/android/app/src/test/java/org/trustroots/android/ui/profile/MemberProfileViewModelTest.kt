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
import org.trustroots.android.api.ApiFailureKind
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
    fun nonAuthenticationProfileFailureStopsLoadingAndRetainsUsefulApiDetails() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.failure(
                MobileApiException(
                    statusCode = 503,
                    serverMessage = "  ",
                    failureKind = ApiFailureKind.REQUEST_REJECTED,
                ),
            )
        }

        val state = newModel("quiet-fox", repository).state.value

        assertFalse(state.isLoading)
        assertNull(state.profile)
        assertEquals(
            MemberProfileFailure(
                MemberProfileFailureReason.PROFILE,
                apiKind = ApiFailureKind.REQUEST_REJECTED,
            ),
            state.failure,
        )
        assertNull(state.pendingSessionInvalidation)
        assertEquals(0, repository.hostingCalls)
        assertEquals(0, repository.contactsCalls)
        assertEquals(0, repository.referenceCalls)
        assertEquals(0, repository.relationshipCalls)

        repository.profileResult = Result.failure(
            MobileApiException(
                statusCode = 503,
                serverMessage = "The profile is temporarily unavailable.",
                failureKind = ApiFailureKind.REQUEST_REJECTED,
            ),
        )
        val messageState = newModel("quiet-fox", repository).state.value
        assertEquals("The profile is temporarily unavailable.", messageState.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, messageState.failure?.apiKind)
    }

    @Test
    fun profileWithoutMemberIDKeepsIdentityAndSkipsRelatedRequestsAndActions() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Quiet Fox").copy(id = null))
        }
        val model = newModel("quiet-fox", repository)

        assertEquals("Quiet Fox", model.state.value.profile?.displayName)
        assertFalse(model.state.value.isLoading)
        assertFalse(model.state.value.hostingLoaded)
        assertFalse(model.state.value.relationshipResolved)
        model.onEvent(MemberProfileEvent.RefreshReferences)
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals(0, repository.hostingCalls)
        assertEquals(0, repository.contactsCalls)
        assertEquals(0, repository.referenceCalls)
        assertEquals(0, repository.relationshipCalls)
        assertTrue(repository.removedContactIDs.isEmpty())
    }

    @Test
    fun viewingOwnProfileSkipsRelationshipAndAccountOrBackendChangesReloadIt() {
        val repository = FakeMemberProfileRepository()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = MemberProfileViewModel("quiet-fox", "quiet-fox", repository, scope)
            assertEquals(1, repository.profileCalls)
            assertEquals(0, repository.relationshipCalls)
            assertFalse(model.state.value.relationshipResolved)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:1"),
                MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self")),
            )
            assertEquals(2, repository.profileCalls)
            assertEquals(1, repository.relationshipCalls)
            assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)

            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self")),
            )
            assertEquals(3, repository.profileCalls)
            assertEquals(2, repository.relationshipCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun parallelSectionAuthenticationFailuresShareOneInvalidation() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            contactsResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            referencesResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            relationshipResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals(1L, state.pendingSessionInvalidation?.id)
        assertFalse(state.isLoading)
        assertTrue(state.hostingLoaded)
        assertEquals(1, repository.hostingCalls)
        assertEquals(1, repository.contactsCalls)
        assertEquals(1, repository.referenceCalls)
        assertEquals(1, repository.relationshipCalls)
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
    fun nonAuthenticationHostingFailureCompletesSectionWithoutInvalidatingSession() {
        val repository = FakeMemberProfileRepository().apply {
            hostingResult = Result.failure(IOException("Temporary hosting failure"))
        }

        val state = newModel("quiet-fox", repository).state.value

        assertEquals("Quiet Fox", state.profile?.displayName)
        assertTrue(state.hostingLoaded)
        assertNull(state.hosting)
        assertNull(state.pendingSessionInvalidation)
    }

    @Test
    fun contactSectionFailurePreservesProfileAndOnlyAuthenticationFailureInvalidatesSession() {
        val repository = FakeMemberProfileRepository().apply {
            contactsResult = Result.failure(IOException("Temporary contacts failure"))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val model = newModel("quiet-fox", repository, scope)

            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
            assertTrue(model.state.value.contacts.isEmpty())
            assertNull(model.state.value.pendingSessionInvalidation)

            repository.contactsResult = Result.failure(MobileApiException(401, "Fictional session expired."))
            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:1"),
                MemberSession("connect.sid=refreshed-fictional-session", MobileMember("member-self", "Member Self")),
            )

            assertEquals("Quiet Fox", model.state.value.profile?.displayName)
            assertTrue(model.state.value.contacts.isEmpty())
            assertEquals(1L, model.state.value.pendingSessionInvalidation?.id)
        } finally {
            scope.cancel()
        }
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
    fun mobileRepositoryDetectsBackendCookieAndAccountIdentityChanges() {
        val originalApi = MobileApiClient("http://127.0.0.1:1")
        val originalSession = MemberSession("connect.sid=fictional-session", MobileMember("member-self", "Member Self"))
        val repository = MobileApiMemberProfileRepository(originalApi, originalSession)

        assertFalse(repository.updateApi(MobileApiClient("http://127.0.0.1:1")))
        assertTrue(repository.updateApi(MobileApiClient("http://127.0.0.1:2")))
        assertFalse(repository.updateSession(originalSession))
        assertTrue(repository.updateSession(MemberSession("connect.sid=refreshed", MobileMember("member-self", "Member Self"))))
        assertTrue(repository.updateSession(MemberSession("connect.sid=refreshed", MobileMember("new-self", "New Self"))))
        assertFalse(repository.updateSession(MemberSession("connect.sid=refreshed", MobileMember("new-self", "New Self"))))
    }

    @Test
    fun referenceRefreshReplacesTheSectionAndRemovalFailureCanBeDismissed() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)

        repository.referencesResult = Result.success(
            listOf(ProfileReference("reference-new", org.trustroots.android.api.MessageMember("new-ref", "new-owl", "New Owl"), "A new fictional note", "yes", null)),
        )
        model.onEvent(MemberProfileEvent.RefreshReferences)
        assertEquals(listOf("new-owl"), model.state.value.references.map { it.author.username })
        assertEquals(2, repository.referenceCalls)

        val savedProfile = profile("quiet-fox", "Updated Quiet Fox")
        model.onEvent(MemberProfileEvent.ProfileSaved(savedProfile))
        assertEquals("Updated Quiet Fox", model.state.value.profile?.displayName)

        repository.removalResult = Result.failure(IOException("Temporary removal failure"))
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
        assertFalse(model.state.value.isRemovingContact)
        assertEquals(MemberProfileFailureReason.REMOVE_CONTACT, model.state.value.removalFailure?.reason)
        model.onEvent(MemberProfileEvent.DismissRemoveContact)

        assertNull(model.state.value.removalFailure)
        assertFalse(model.state.value.contactRemovalSucceeded)
        assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)

        repository.removalResult = Result.success(Unit)
        model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

        assertEquals(listOf("relationship-fox", "relationship-fox"), repository.removedContactIDs)
        assertNull(model.state.value.removalFailure)
        assertTrue(model.state.value.contactRemovalSucceeded)
        assertFalse(model.state.value.isRemovingContact)
        assertEquals(ContactRelationship(null, false), model.state.value.relationship)
    }

    @Test
    fun nonAuthenticationReferenceRefreshFailureKeepsPreviouslyLoadedReferences() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)
        val originalReferences = model.state.value.references
        repository.referencesResult = Result.failure(IOException("Temporary references failure"))

        model.onEvent(MemberProfileEvent.RefreshReferences)

        assertEquals(originalReferences, model.state.value.references)
        assertNull(model.state.value.pendingSessionInvalidation)
        assertEquals(2, repository.referenceCalls)
    }

    @Test
    fun newestReferenceRefreshWinsWhenAnOlderRequestCompletesLate() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val staleReferences = CompletableDeferred<Result<List<ProfileReference>>>()
        val repository = FakeMemberProfileRepository().apply {
            referencesHandler = { call ->
                when (call) {
                    2 -> withContext(NonCancellable) { staleReferences.await() }
                    3 -> Result.success(listOf(reference("current-reference", "current-owl")))
                    else -> Result.success(listOf(reference("initial-reference", "initial-owl")))
                }
            }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.RefreshReferences)
            model.onEvent(MemberProfileEvent.RefreshReferences)
            staleReferences.complete(Result.success(listOf(reference("stale-reference", "stale-owl"))))

            assertEquals(listOf("current-owl"), model.state.value.references.map { it.author.username })
            assertEquals(3, repository.referenceCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun inFlightContactRemovalCannotBeDuplicatedAndCompletesWithTheCanonicalRelationship() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val pendingRemoval = CompletableDeferred<Result<Unit>>()
        val repository = FakeMemberProfileRepository().apply {
            removalHandler = { withContext(NonCancellable) { pendingRemoval.await() } }
        }
        try {
            val model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
            model.onEvent(MemberProfileEvent.ConfirmRemoveContact)
            model.onEvent(MemberProfileEvent.DismissRemoveContact)

            assertEquals(listOf("relationship-fox"), repository.removedContactIDs)
            assertTrue(model.state.value.isRemovingContact)
            assertEquals(ContactRelationship("relationship-fox", true), model.state.value.relationship)

            pendingRemoval.complete(Result.success(Unit))

            assertEquals(ContactRelationship(null, false), model.state.value.relationship)
            assertTrue(model.state.value.contactRemovalSucceeded)
            assertFalse(model.state.value.isRemovingContact)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun environmentRefreshDuringRemovalRejectsTheSynchronousOldAuthenticationFailure() {
        val repository = FakeMemberProfileRepository().apply {
            profileResult = Result.success(profile("quiet-fox", "Fresh Profile"))
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        lateinit var model: MemberProfileViewModel
        repository.removalHandler = {
            model.updateEnvironment(
                MobileApiClient("http://127.0.0.1:2"),
                MemberSession("connect.sid=rotated-fictional-session", MobileMember("member-self", "Member Self")),
            )
            Result.failure(MobileApiException(401, "Fictional stale session."))
        }
        try {
            model = newModel("quiet-fox", repository, scope)
            model.onEvent(MemberProfileEvent.ConfirmRemoveContact)

            assertEquals("Fresh Profile", model.state.value.profile?.displayName)
            assertNull(model.state.value.pendingSessionInvalidation)
            assertFalse(model.state.value.isRemovingContact)
            assertNull(model.state.value.removalFailure)
            assertEquals(2, repository.profileCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun referenceAuthenticationFailureInvalidatesSessionAndBlocksFurtherRefreshes() {
        val repository = FakeMemberProfileRepository()
        val model = newModel("quiet-fox", repository)
        assertEquals(1, repository.referenceCalls)

        repository.referencesResult = Result.failure(MobileApiException(401, "Fictional session expired."))
        model.onEvent(MemberProfileEvent.RefreshReferences)
        val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberProfileEvent.RefreshReferences)
        model.onEvent(MemberProfileEvent.SessionInvalidationDelivered(invalidation.id + 1))

        assertEquals(2, repository.referenceCalls)
        assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberProfileEvent.SessionInvalidationDelivered(invalidation.id))
        assertNull(model.state.value.pendingSessionInvalidation)
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
        var currentApi: MobileApiClient? = MobileApiClient("http://127.0.0.1:1")
        var hostingCalls = 0
        var contactsCalls = 0
        var hostingResult: Result<AccommodationOffer?> = Result.success(AccommodationOffer("offer-fox", "yes", "A home", null, 2))
        var relationshipResult: Result<ContactRelationship> = Result.success(ContactRelationship("relationship-fox", true))
        var relationshipCalls = 0
        var referenceCalls = 0
        var contactsResult: Result<List<ProfileContact>> = Result.success(
            listOf(ProfileContact("contact-owl", org.trustroots.android.api.MessageMember("owl-id", "steady-owl", "Steady Owl"))),
        )
        var referencesResult: Result<List<ProfileReference>> = Result.success(
            listOf(ProfileReference("reference-one", org.trustroots.android.api.MessageMember("ref-id", "reference-owl", "Reference Owl"), "A kind visit", "yes", null)),
        )
        var referencesHandler: (suspend (Int) -> Result<List<ProfileReference>>)? = null
        var removalResult: Result<Unit> = Result.success(Unit)
        var removalHandler: (suspend (String) -> Result<Unit>)? = null
        override fun updateApi(api: MobileApiClient): Boolean {
            val changed = currentApi?.backendURL != api.backendURL
            currentApi = api
            return changed
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
        override suspend fun hosting(memberID: String): Result<AccommodationOffer?> {
            hostingCalls++
            return hostingResult
        }
        override suspend fun contacts(memberID: String): Result<List<ProfileContact>> {
            contactsCalls++
            return contactsResult
        }
        override suspend fun references(memberID: String): Result<List<ProfileReference>> {
            referenceCalls++
            return referencesHandler?.invoke(referenceCalls) ?: referencesResult
        }
        override suspend fun relationship(memberID: String): Result<ContactRelationship> {
            relationshipCalls++
            return relationshipResult
        }
        override suspend fun removeContact(contactID: String): Result<Unit> {
            removedContactIDs += contactID
            return removalHandler?.invoke(contactID) ?: removalResult
        }
    }

    private companion object {
        fun reference(id: String, author: String) = ProfileReference(
            id,
            org.trustroots.android.api.MessageMember("member-$author", author, author),
            "A fictional reference",
            "yes",
            null,
        )

        fun profile(username: String, displayName: String) = MemberProfile(
            id = "member-$username", username = username, displayName = displayName,
            tagline = null, description = null, location = null, languages = emptyList(),
        )
    }
}
