package org.trustroots.android.ui.signin

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

class SignInViewModelTest {
    @Test
    fun initialMessageAndCredentialEventsUpdateImmutableState() {
        val viewModel = SignInViewModel(
            apiBaseUrl = "https://api.example.test",
            initialMessage = "Please sign in again.",
            authenticator = SignInAuthenticator { _, _ -> error("Sign-in should not run") },
            scope = testScope(),
        )

        assertEquals(SignInUiState(error = "Please sign in again."), viewModel.state.value)
        viewModel.onEvent(SignInEvent.UsernameChanged("  anonymous-heron  "))
        viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))

        assertEquals("  anonymous-heron  ", viewModel.state.value.username)
        assertEquals("fictional-password", viewModel.state.value.password)
        assertEquals("Please sign in again.", viewModel.state.value.error)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun submissionTrimsUsernameRetainsProgressUntilResponseAndAcknowledgesSuccess() {
        val response = CompletableDeferred<Result<MemberSession>>()
        val submitted = mutableListOf<Pair<String, String>>()
        val session = MemberSession("connect.sid=fictional-session", MobileMember("anonymous-heron", "Anonymous Heron"))
        val viewModel = SignInViewModel(
            apiBaseUrl = "https://api.example.test",
            initialMessage = null,
            authenticator = SignInAuthenticator { username, password ->
                submitted += username to password
                response.await()
            },
            scope = testScope(),
        )
        viewModel.onEvent(SignInEvent.UsernameChanged("  anonymous-heron  "))
        viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))

        viewModel.onEvent(SignInEvent.Submit)
        assertTrue(viewModel.state.value.isLoading)
        assertEquals(listOf("anonymous-heron" to "fictional-password"), submitted)

        viewModel.onEvent(SignInEvent.Submit)
        assertEquals("A second request must not start while the first is pending", 1, submitted.size)
        response.complete(Result.success(session))

        val success = viewModel.state.value.pendingSuccess
        assertNotNull(success)
        assertEquals(session, success?.session)
        assertFalse(viewModel.state.value.isLoading)
        viewModel.onEvent(SignInEvent.SuccessDelivered(requireNotNull(success).id))
        assertNull(viewModel.state.value.pendingSuccess)
        assertEquals("anonymous-heron", viewModel.state.value.username.trim())
        assertEquals("fictional-password", viewModel.state.value.password)
    }

    @Test
    fun failedSubmissionKeepsCredentialsEditableAndShowsApiMessage() {
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "https://api.example.test",
                initialMessage = null,
                authenticator = SignInAuthenticator { _, _ ->
                    Result.failure(IOException("Those credentials were not accepted."))
                },
                scope = scope,
            )
            viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-wrong-password"))

            viewModel.onEvent(SignInEvent.Submit)

            assertFalse(viewModel.state.value.isLoading)
            assertEquals("Those credentials were not accepted.", viewModel.state.value.error)
            assertEquals("anonymous-heron", viewModel.state.value.username)
            assertEquals("fictional-wrong-password", viewModel.state.value.password)
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-corrected-password"))
            assertEquals("fictional-corrected-password", viewModel.state.value.password)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun clearedDestinationStoreCreatesFreshViewModelWithCurrentMessage() {
        val holder = SignInDestinationStoreHolder()
        val first = holder.getViewModel("https://api.example.test", null)
        first.onEvent(SignInEvent.UsernameChanged("previous-member"))
        first.onEvent(SignInEvent.PasswordChanged("fictional-password"))

        holder.clearDestination()
        val next = holder.getViewModel("https://api.example.test", "Your session has expired.")

        assertTrue(first !== next)
        assertEquals(SignInUiState(), first.state.value)
        assertEquals(SignInUiState(error = "Your session has expired."), next.state.value)
    }

    @Test
    fun cancelledRequestCannotPublishAnAuthenticatorWrappedCancellation() {
        val pendingResponse = CompletableDeferred<Result<MemberSession>>()
        val job = SupervisorJob()
        val scope = CoroutineScope(job + Dispatchers.Unconfined)
        val viewModel = SignInViewModel(
            apiBaseUrl = "https://api.example.test",
            initialMessage = null,
            authenticator = SignInAuthenticator { _, _ ->
                try {
                    pendingResponse.await()
                } catch (cancellation: CancellationException) {
                    Result.failure(cancellation)
                }
            },
            scope = scope,
        )
        viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
        viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))
        viewModel.onEvent(SignInEvent.Submit)
        assertTrue(viewModel.state.value.isLoading)

        job.cancel()

        assertNull(viewModel.state.value.error)
        assertNull(viewModel.state.value.pendingSuccess)
        scope.cancel()
    }

    private fun testScope() = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
}
