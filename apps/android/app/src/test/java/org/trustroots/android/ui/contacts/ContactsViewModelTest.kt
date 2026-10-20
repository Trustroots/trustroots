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
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiException
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
        assertEquals("Fictional contacts service is unavailable.", viewModel.state.value.failure?.serverMessage)
        assertEquals(ContactsFailureReason.CONTACTS, viewModel.state.value.failure?.reason)

        viewModel.onEvent(ContactsEvent.Retry)

        assertEquals(2, repository.contactMemberIDs.size)
        assertEquals(listOf(contact("quiet-fox"), contact("amber-owl")), viewModel.state.value.contacts)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun profileAuthenticationFailureIsAcknowledgedOnceAndCannotBeRetried() = withScope { scope ->
        val repository = FakeContactsRepository()
        repository.profileHandler = { Result.failure(MobileApiException(401, "Expired")) }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)
        val pending = requireNotNull(viewModel.state.value.pendingSessionInvalidation)

        viewModel.onEvent(ContactsEvent.SessionInvalidationDelivered(pending.id))
        viewModel.onEvent(ContactsEvent.Retry)

        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertEquals(1, repository.profileUsernames.size)
        assertTrue(repository.contactMemberIDs.isEmpty())
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
        var profileHandler: suspend (Int) -> Result<MemberProfile> = {
            Result.success(memberProfile("member-self"))
        }
        var contactsHandler: suspend (Int) -> Result<List<ProfileContact>> = {
            Result.success(listOf(contact("quiet-fox")))
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
