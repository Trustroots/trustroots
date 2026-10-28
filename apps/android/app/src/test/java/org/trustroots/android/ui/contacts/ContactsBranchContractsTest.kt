package org.trustroots.android.ui.contacts

import androidx.lifecycle.ViewModel
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
import org.trustroots.android.api.ProfileContact

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class ContactsBranchContractsTest {
    @Test
    fun obsoleteProfileAuthenticationFailureAfterCredentialReplacementIsIgnored() = withScope { scope ->
        val obsoleteProfile = CompletableDeferred<Result<MemberProfile>>()
        val repository = FakeRepository().apply {
            profileHandler = { attempt ->
                if (attempt == 1) withContext(NonCancellable) { obsoleteProfile.await() }
                else Result.success(memberProfile("member-current"))
            }
        }
        val viewModel = ContactsViewModel("steady-heron", repository, scope)

        viewModel.updateEnvironment(
            MobileApiClient("https://api.example.test/"),
            session("connect.sid=renewed"),
        )
        assertEquals(listOf(contact("quiet-fox")), viewModel.state.value.contacts)

        obsoleteProfile.complete(Result.failure(MobileApiException(401, "Fictional obsolete session.")))

        assertEquals(listOf(contact("quiet-fox")), viewModel.state.value.contacts)
        assertFalse(viewModel.state.value.isSessionInvalidated)
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertNull(viewModel.state.value.failure)
        assertFalse(viewModel.state.value.isLoading)
        assertEquals(listOf("steady-heron", "steady-heron"), repository.profileUsernames)
    }

    @Test
    fun clearingCompletedEntryResetsStateWhenThereIsNoRequestToCancel() = withScope { scope ->
        val store = ViewModelStore()
        try {
            val viewModel = ViewModelProvider(
                StoreOwner(store),
                ContactsViewModel.Factory("steady-heron", FakeRepository(), scope),
            )[ContactsViewModel::class.java]

            assertEquals(listOf(contact("quiet-fox")), viewModel.state.value.contacts)
            assertFalse(viewModel.state.value.isLoading)
            store.clear()

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

    private class FakeRepository : ContactsRepository {
        val profileUsernames = mutableListOf<String>()
        private var currentApi = MobileApiClient("https://api.example.test/")
        private var currentSession = session("connect.sid=old")
        var profileHandler: suspend (Int) -> Result<MemberProfile> = { Result.success(memberProfile("member-self")) }
        private var contactHandler: suspend () -> Result<List<ProfileContact>> = {
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

        override suspend fun contacts(memberID: String): Result<List<ProfileContact>> = contactHandler()
    }

    private companion object {
        fun session(cookie: String) = MemberSession(
            cookie,
            MobileMember("steady-heron", "Steady Heron"),
        )

        fun memberProfile(id: String) = MemberProfile(
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
