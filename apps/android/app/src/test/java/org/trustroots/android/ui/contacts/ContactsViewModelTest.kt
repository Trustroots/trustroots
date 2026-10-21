package org.trustroots.android.ui.contacts

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
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.ProfileContact

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class ContactsViewModelTest {
    @Test
    fun successfulLoadRequestsCurrentProfileThenContacts() = withScope { scope ->
        val repository = FakeContactsRepository()
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        assertEquals(listOf("steady-heron"), repository.profileUsernames)
        assertEquals(listOf("member-self"), repository.contactMemberIDs)
        assertEquals(listOf(contact("quiet-fox")), viewModel.state.value.contacts)
        assertTrue(viewModel.state.value.hasAttemptedLoad)
        assertFalse(viewModel.state.value.isLoading)
        assertNull(viewModel.state.value.failure)

        viewModel.updateEnvironment(
            MobileApiClient("https://api.example.test"),
            session(cookie = "connect.sid=old"),
        )
        assertEquals("An unchanged account/backend must not refetch Contacts", listOf("steady-heron"), repository.profileUsernames)
        assertEquals(listOf("member-self"), repository.contactMemberIDs)
    }

    @Test
    fun mobileRepositoryReportsOnlyBackendOrAuthenticatedIdentityChanges() {
        val api = MobileApiClient("https://api.example.test/")
        val original = session(cookie = "connect.sid=old")
        val repository = MobileApiContactsRepository(api, original)

        assertFalse(repository.updateEnvironment(MobileApiClient("https://api.example.test"), original))
        assertTrue(repository.updateEnvironment(MobileApiClient("https://other.example.test"), original))
        assertTrue(repository.updateEnvironment(MobileApiClient("https://other.example.test/"), session(cookie = "connect.sid=new")))
        assertTrue(repository.updateEnvironment(MobileApiClient("https://other.example.test"), session(cookie = "connect.sid=new", username = "amber-owl")))
        assertFalse(repository.updateEnvironment(MobileApiClient("https://other.example.test/"), session(cookie = "connect.sid=new", username = "amber-owl")))
    }

    @Test
    fun retryWhileProfileIsLoadingDoesNotStartAnotherRequest() = withScope { scope ->
        val finishProfile = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeContactsRepository().apply {
            profileHandler = { call ->
                if (call == 1) finishProfile.await() else Result.success(memberProfile("member-self"))
            }
        }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        assertTrue(viewModel.state.value.isLoading)
        viewModel.onEvent(ContactsEvent.Retry)

        assertEquals(listOf("steady-heron"), repository.profileUsernames)
        assertTrue(viewModel.state.value.isLoading)
        finishProfile.complete(Result.success(memberProfile("member-self")))

        assertEquals(listOf("member-self"), repository.contactMemberIDs)
        assertEquals(listOf(contact("quiet-fox")), viewModel.state.value.contacts)
    }

    @Test
    fun reentrantEnvironmentChangeRejectsTheObsoleteContactsSuccess() = withScope { scope ->
        lateinit var viewModel: ContactsViewModel
        val repository = FakeContactsRepository().apply {
            contactsHandler = { call ->
                when (call) {
                    2 -> {
                        // The retry's launch is running inline before load assigns its new Job.
                        viewModel.updateEnvironment(
                            MobileApiClient("https://other.example.test"),
                            session(cookie = "connect.sid=renewed"),
                        )
                        Result.success(listOf(contact("obsolete-fox")))
                    }
                    3 -> Result.success(listOf(contact("current-owl")))
                    else -> Result.success(listOf(contact("initial-fox")))
                }
            }
        }
        viewModel = ContactsViewModel("steady-heron", repository, scope)

        viewModel.onEvent(ContactsEvent.Retry)

        assertEquals(3, repository.contactMemberIDs.size)
        assertEquals(listOf(contact("current-owl")), viewModel.state.value.contacts)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun reentrantEnvironmentChangeRejectsAnObsoleteContactsFailure() = withScope { scope ->
        lateinit var viewModel: ContactsViewModel
        val repository = FakeContactsRepository().apply {
            contactsHandler = { call ->
                when (call) {
                    2 -> {
                        viewModel.updateEnvironment(
                            MobileApiClient("https://other.example.test"),
                            session(cookie = "connect.sid=renewed"),
                        )
                        Result.failure(MobileApiException(401, "Fictional stale session."))
                    }
                    3 -> Result.success(listOf(contact("current-owl")))
                    else -> Result.success(listOf(contact("initial-fox")))
                }
            }
        }
        viewModel = ContactsViewModel("steady-heron", repository, scope)

        viewModel.onEvent(ContactsEvent.Retry)

        assertEquals(listOf(contact("current-owl")), viewModel.state.value.contacts)
        assertFalse(viewModel.state.value.isSessionInvalidated)
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun missingProfileIDShowsTypedFailureWithoutRequestingContacts() = withScope { scope ->
        val repository = FakeContactsRepository()
        repository.profileHandler = { Result.success(memberProfile(id = null)) }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        assertEquals(ContactsFailureReason.MISSING_MEMBER_ID, viewModel.state.value.failure?.reason)
        assertNull(viewModel.state.value.failure?.serverMessage)
        assertTrue(repository.contactMemberIDs.isEmpty())
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun failedContactsRequestCanRetryAndReplaceFailureWithResults() = withScope { scope ->
        val repository = FakeContactsRepository()
        repository.contactsHandler = { attempt ->
            if (attempt == 1) Result.failure(IOException("Fictional contacts service is unavailable."))
            else Result.success(listOf(contact("quiet-fox"), contact("amber-owl")))
        }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)
        assertNull(viewModel.state.value.failure?.serverMessage)
        assertNull(viewModel.state.value.failure?.apiKind)
        assertEquals(IOException::class.java.name, viewModel.state.value.failure?.throwableType)
        assertEquals(ContactsFailureReason.CONTACTS, viewModel.state.value.failure?.reason)

        viewModel.onEvent(ContactsEvent.Retry)

        assertEquals(2, repository.contactMemberIDs.size)
        assertEquals(listOf(contact("quiet-fox"), contact("amber-owl")), viewModel.state.value.contacts)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun thrownProfileAndContactsFailuresAreTypedAndEachStageCanRetry() = withScope { scope ->
        val repository = FakeContactsRepository().apply {
            profileHandler = { attempt ->
                if (attempt == 1) throw IOException("Temporary profile lookup failure")
                Result.success(memberProfile("member-self"))
            }
            contactsHandler = { attempt ->
                if (attempt == 1) throw IOException("Temporary contacts lookup failure")
                Result.success(listOf(contact("recovered-fox")))
            }
        }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        assertEquals(ContactsFailureReason.PROFILE, viewModel.state.value.failure?.reason)
        assertEquals(IOException::class.java.name, viewModel.state.value.failure?.throwableType)
        assertTrue(repository.contactMemberIDs.isEmpty())

        viewModel.onEvent(ContactsEvent.Retry)
        assertEquals(ContactsFailureReason.CONTACTS, viewModel.state.value.failure?.reason)
        assertEquals(IOException::class.java.name, viewModel.state.value.failure?.throwableType)

        viewModel.onEvent(ContactsEvent.Retry)
        assertEquals(listOf(contact("recovered-fox")), viewModel.state.value.contacts)
        assertEquals(3, repository.profileUsernames.size)
        assertEquals(2, repository.contactMemberIDs.size)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun backendSwitchAndSameUserCredentialRotationCancelStaleResponses() = withScope { scope ->
        val staleBackendResponse = CompletableDeferred<Result<List<ProfileContact>>>()
        val repository = FakeContactsRepository().apply {
            contactsHandler = { attempt ->
                when (attempt) {
                    2 -> withContext(NonCancellable) { staleBackendResponse.await() }
                    3 -> Result.success(listOf(contact("rotated-owl")))
                    else -> Result.success(listOf(contact("initial-fox")))
                }
            }
        }
        val firstSession = session(cookie = "connect.sid=old")
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        assertEquals(listOf(contact("initial-fox")), viewModel.state.value.contacts)
        viewModel.updateEnvironment(MobileApiClient("https://other.example.test"), firstSession)
        assertTrue(viewModel.state.value.isLoading)

        val refreshedSession = session(cookie = "connect.sid=rotated")
        viewModel.updateEnvironment(MobileApiClient("https://other.example.test/"), refreshedSession)
        staleBackendResponse.complete(Result.failure(MobileApiException(401, "Fictional stale response")))

        assertEquals(listOf(contact("rotated-owl")), viewModel.state.value.contacts)
        assertFalse(viewModel.state.value.isSessionInvalidated)
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertFalse(viewModel.state.value.isLoading)
        assertFalse(repository.updateEnvironment(MobileApiClient("https://other.example.test"), refreshedSession))
    }

    @Test
    fun storesOnlyNonblankApiServerMessageAndFailureKind() = withScope { scope ->
        val repository = FakeContactsRepository()
        repository.contactsHandler = {
            Result.failure(
                MobileApiException(
                    statusCode = 503,
                    serverMessage = "A fictional contacts response.",
                    failureKind = ApiFailureKind.REQUEST_REJECTED,
                ),
            )
        }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        assertEquals("A fictional contacts response.", viewModel.state.value.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, viewModel.state.value.failure?.apiKind)

        repository.contactsHandler = {
            Result.failure(MobileApiException(503, serverMessage = " \t", failureKind = ApiFailureKind.REQUEST_REJECTED))
        }
        viewModel.onEvent(ContactsEvent.Retry)

        assertNull(viewModel.state.value.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, viewModel.state.value.failure?.apiKind)
    }

    @Test
    fun profileAuthenticationFailureIsAcknowledgedOnceAndCannotBeRetried() = withScope { scope ->
        val repository = FakeContactsRepository()
        repository.profileHandler = { Result.failure(MobileApiException(401, "Expired")) }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)
        val pending = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        viewModel.onEvent(ContactsEvent.SessionInvalidationDelivered(pending.id + 1))
        assertEquals(pending, viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(ContactsEvent.SessionInvalidationDelivered(pending.id))
        viewModel.onEvent(ContactsEvent.Retry)

        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertTrue(viewModel.state.value.isSessionInvalidated)
        assertTrue(viewModel.state.value.contacts.isEmpty())
        assertEquals(1, repository.profileUsernames.size)
        assertTrue(repository.contactMemberIDs.isEmpty())
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun contactsAuthenticationFailureInvalidatesSessionAndPreventsRetryAtThatStage() = withScope { scope ->
        val repository = FakeContactsRepository().apply {
            contactsHandler = { Result.failure(MobileApiException(401, "Fictional expired session.")) }
        }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)
        val pending = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        assertTrue(viewModel.state.value.isSessionInvalidated)
        assertTrue(viewModel.state.value.contacts.isEmpty())
        assertEquals(1, repository.profileUsernames.size)
        assertEquals(1, repository.contactMemberIDs.size)
        viewModel.onEvent(ContactsEvent.Retry)

        assertEquals(pending, viewModel.state.value.pendingSessionInvalidation)
        assertEquals(1, repository.profileUsernames.size)
        assertEquals(1, repository.contactMemberIDs.size)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun removingTheOwningEntryCancelsAnInFlightContactsRequestAndClearsState() = withScope { scope ->
        val store = ViewModelStore()
        val response = CompletableDeferred<Result<List<ProfileContact>>>()
        val cancelled = CompletableDeferred<Unit>()
        val repository = FakeContactsRepository()
        repository.contactsHandler = {
            try {
                response.await()
            } finally {
                cancelled.complete(Unit)
            }
        }
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                ContactsViewModel.Factory("steady-heron", repository, scope),
            )[ContactsViewModel::class.java]
            assertTrue(viewModel.state.value.isLoading)
            store.clear()

            assertTrue(cancelled.isCompleted)
            assertEquals(ContactsUiState(), viewModel.state.value)
        } finally {
            store.clear()
        }
    }

    @Test
    fun lateContactsResponseAfterEntryRemovalCannotRestoreClearedState() = withScope { scope ->
        val store = ViewModelStore()
        val response = CompletableDeferred<Result<List<ProfileContact>>>()
        val repository = FakeContactsRepository()
        repository.contactsHandler = { withContext(NonCancellable) { response.await() } }
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                ContactsViewModel.Factory("steady-heron", repository, scope),
            )[ContactsViewModel::class.java]
            store.clear()
            assertEquals(ContactsUiState(), viewModel.state.value)

            response.complete(Result.success(listOf(contact("late-fox"))))

            assertEquals(ContactsUiState(), viewModel.state.value)
        } finally {
            store.clear()
        }
    }

    @Test
    fun lateAuthenticationFailureAfterEntryRemovalDoesNotInvalidateSession() = withScope { scope ->
        val store = ViewModelStore()
        val response = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeContactsRepository()
        repository.profileHandler = { withContext(NonCancellable) { response.await() } }
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                ContactsViewModel.Factory("steady-heron", repository, scope),
            )[ContactsViewModel::class.java]
            assertTrue(viewModel.state.value.isLoading)
            store.clear()

            response.complete(Result.failure(MobileApiException(401, "Expired")))

            assertEquals(ContactsUiState(), viewModel.state.value)
        } finally {
            store.clear()
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

    private class FakeContactsRepository : ContactsRepository {
        val profileUsernames = mutableListOf<String>()
        val contactMemberIDs = mutableListOf<String>()
        var currentApi = MobileApiClient("https://api.example.test/")
        var currentSession = session(cookie = "connect.sid=old")
        var profileHandler: suspend (Int) -> Result<MemberProfile> = {
            Result.success(memberProfile("member-self"))
        }
        var contactsHandler: suspend (Int) -> Result<List<ProfileContact>> = {
            Result.success(listOf(contact("quiet-fox")))
        }

        override fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean {
            val changed = currentApi.backendURL != api.backendURL ||
                currentSession.cookieHeader != session.cookieHeader ||
                currentSession.member.username != session.member.username
            currentApi = api
            currentSession = session
            return changed
        }

        override suspend fun profile(username: String): Result<MemberProfile> {
            profileUsernames += username
            return profileHandler(profileUsernames.size)
        }

        override suspend fun contacts(memberID: String): Result<List<ProfileContact>> {
            contactMemberIDs += memberID
            return contactsHandler(contactMemberIDs.size)
        }
    }

    private companion object {
        fun session(cookie: String, username: String = "steady-heron") =
            MemberSession(cookie, MobileMember(username, username.replaceFirstChar { it.uppercase() }))

        fun memberProfile(id: String? = "member-self") = MemberProfile(
            id = id,
            username = "steady-heron",
            displayName = "Steady Heron",
            tagline = null,
            description = null,
            location = null,
            languages = emptyList(),
        )

        fun contact(username: String) = ProfileContact(
            id = "contact-$username",
            user = MessageMember("member-$username", username, username.replaceFirstChar { it.uppercase() }),
        )
    }
}
