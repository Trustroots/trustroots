package org.trustroots.android.ui.signin

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

class SignInViewModelTest {
    @Test
    fun defaultAuthenticatorSubmitsThroughTheConfiguredApiClient() = runBlocking {
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "http://127.0.0.1:1",
                initialMessage = null,
                scope = scope,
            )
            viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))

            viewModel.onEvent(SignInEvent.Submit)

            val state = withTimeout(5_000) {
                viewModel.state.first { !it.isLoading && it.error != null }
            }
            assertEquals(UiFailure(fallback = UiFailureFallback.REACH_TRUSTROOTS), state.error)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun unexpectedAuthenticatorFailureUsesTheSafeFallbackMessage() {
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "https://api.example.test",
                initialMessage = null,
                authenticator = SignInAuthenticator { _, _ -> throw IllegalStateException() },
                scope = scope,
            )
            viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))

            viewModel.onEvent(SignInEvent.Submit)

            assertFalse(viewModel.state.value.isLoading)
            assertEquals(UiFailure(fallback = UiFailureFallback.REACH_TRUSTROOTS), viewModel.state.value.error)
            assertNull(viewModel.state.value.pendingSuccess)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun blankCredentialsDoNotStartAuthenticationAndKeepTheFormReady() {
        var calls = 0
        val viewModel = SignInViewModel(
            apiBaseUrl = "https://api.example.test",
            initialMessage = null,
            authenticator = SignInAuthenticator { _, _ ->
                calls++
                error("Blank credentials must not be submitted")
            },
            scope = testScope(),
        )

        viewModel.onEvent(SignInEvent.Submit)
        viewModel.onEvent(SignInEvent.UsernameChanged("   "))
        viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))
        viewModel.onEvent(SignInEvent.Submit)
        viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
        viewModel.onEvent(SignInEvent.PasswordChanged("  "))
        viewModel.onEvent(SignInEvent.Submit)

        assertEquals(0, calls)
        assertFalse(viewModel.state.value.isLoading)
        assertNull(viewModel.state.value.pendingSuccess)
        assertNull(viewModel.state.value.error)
    }

    @Test
    fun initialMessageAndCredentialEventsUpdateImmutableState() {
        val viewModel = SignInViewModel(
            apiBaseUrl = "https://api.example.test",
            initialMessage = UiFailure(fallback = UiFailureFallback.SESSION_EXPIRED),
            authenticator = SignInAuthenticator { _, _ -> error("Sign-in should not run") },
            scope = testScope(),
        )

        assertEquals(SignInUiState(error = UiFailure(fallback = UiFailureFallback.SESSION_EXPIRED)), viewModel.state.value)
        viewModel.onEvent(SignInEvent.UsernameChanged("  anonymous-heron  "))
        viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))

        assertEquals("  anonymous-heron  ", viewModel.state.value.username)
        assertEquals("fictional-password", viewModel.state.value.password)
        assertEquals(UiFailure(fallback = UiFailureFallback.SESSION_EXPIRED), viewModel.state.value.error)
        assertFalse(viewModel.state.value.isLoading)
    }

    @Test
    fun successDeliveryBeforeAnyPendingSuccessLeavesTheFormUnchanged() {
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "https://api.example.test",
                initialMessage = null,
                authenticator = SignInAuthenticator { _, _ -> error("Sign-in should not run") },
                scope = scope,
            )
            val initialState = viewModel.state.value

            viewModel.onEvent(SignInEvent.SuccessDelivered(1L))

            assertEquals(initialState, viewModel.state.value)
            assertNull(viewModel.state.value.pendingSuccess)
        } finally {
            scope.cancel()
        }
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
        viewModel.onEvent(SignInEvent.Submit)
        assertEquals("A pending success must not start another request", 1, submitted.size)
        val successID = requireNotNull(success).id
        viewModel.onEvent(SignInEvent.SuccessDelivered(successID + 1))
        assertEquals(
            "A stale navigation acknowledgement must not consume the current sign-in",
            success,
            viewModel.state.value.pendingSuccess,
        )
        viewModel.onEvent(SignInEvent.SuccessDelivered(successID))
        assertNull(viewModel.state.value.pendingSuccess)
        assertEquals("anonymous-heron", viewModel.state.value.username.trim())
        assertEquals("fictional-password", viewModel.state.value.password)
    }

    @Test
    fun failedSubmissionKeepsCredentialsEditableAndStoresFallbackIdentity() {
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
            assertEquals(UiFailure(fallback = UiFailureFallback.REACH_TRUSTROOTS), viewModel.state.value.error)
            assertEquals("anonymous-heron", viewModel.state.value.username)
            assertEquals("fictional-wrong-password", viewModel.state.value.password)
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-corrected-password"))
            assertEquals("fictional-corrected-password", viewModel.state.value.password)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun failedSignInRetainsDynamicServerTextAndApiKind() {
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "https://api.example.test",
                initialMessage = null,
                authenticator = SignInAuthenticator { _, _ ->
                    Result.failure(
                        org.trustroots.android.api.MobileApiException(
                            statusCode = 401,
                            serverMessage = "A fictional sign-in response.",
                            failureKind = org.trustroots.android.api.ApiFailureKind.SIGN_IN_REJECTED,
                        ),
                    )
                },
                scope = scope,
            )
            viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))
            viewModel.onEvent(SignInEvent.Submit)

            assertEquals(
                UiFailure(
                    serverMessage = "A fictional sign-in response.",
                    apiKind = org.trustroots.android.api.ApiFailureKind.SIGN_IN_REJECTED,
                    fallback = UiFailureFallback.REACH_TRUSTROOTS,
                ),
                viewModel.state.value.error,
            )
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun blankCredentialsDoNotStartAuthentication() {
        var requests = 0
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "https://api.example.test",
                initialMessage = null,
                authenticator = SignInAuthenticator { _, _ ->
                    requests++
                    error("Blank credentials must not be submitted")
                },
                scope = scope,
            )

            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))
            viewModel.onEvent(SignInEvent.Submit)
            viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
            viewModel.onEvent(SignInEvent.PasswordChanged("  "))
            viewModel.onEvent(SignInEvent.Submit)

            assertEquals(0, requests)
            assertFalse(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.pendingSuccess)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun thrownAuthenticatorFailureBecomesTheReachTrustrootsFallback() {
        val scope = testScope()
        try {
            val viewModel = SignInViewModel(
                apiBaseUrl = "https://api.example.test",
                initialMessage = null,
                authenticator = SignInAuthenticator { _, _ -> throw IOException("A fictional transport failure.") },
                scope = scope,
            )
            viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
            viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))
            viewModel.onEvent(SignInEvent.Submit)

            assertEquals(UiFailure(fallback = UiFailureFallback.REACH_TRUSTROOTS), viewModel.state.value.error)
            assertFalse(viewModel.state.value.isLoading)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun signInFactoryRejectsUnrelatedViewModelTypes() {
        val factory = SignInViewModelFactory("https://api.example.test", null)
        val failure = runCatching { factory.create(OtherViewModel::class.java) }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }

    @Test
    fun signInFactoryCreatesAViewModelWithItsDefaultScope() {
        val store = ViewModelStore()
        val owner = object : ViewModelStoreOwner {
            override val viewModelStore = store
        }
        val viewModel = ViewModelProvider(
            owner,
            SignInViewModelFactory("https://api.example.test", null),
        ).get(SignInViewModel::class.java)

        viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
        assertEquals("anonymous-heron", viewModel.state.value.username)
        store.clear()
        assertEquals(SignInUiState(), viewModel.state.value)
    }

    @Test
    fun graphHolderResetsOnlyWhenItsDestinationIsClearedOrBackendChanges() {
        val holder = SignInDestinationStoreHolder()
        holder.activateBackend("https://api.example.test/")
        assertEquals(0L, holder.graphGeneration.value)
        holder.activateBackend("https://api.example.test")
        assertEquals(0L, holder.graphGeneration.value)
        holder.activateBackend("https://other.example.test")
        assertEquals(1L, holder.graphGeneration.value)
        holder.clearDestination()
        assertEquals(2L, holder.graphGeneration.value)
    }

    @Test
    fun clearingTheNavigationEntryCancelsItsRequestAndErasesCredentials() {
        val requestStarted = CountDownLatch(1)
        val requestCancelled = CountDownLatch(1)
        val scope = testScope()
        val store = ViewModelStore()
        val owner = object : ViewModelStoreOwner {
            override val viewModelStore = store
        }
        val viewModel = ViewModelProvider(
            owner,
            SignInViewModelFactory(
                "https://api.example.test",
                null,
                SignInAuthenticator { _, _ ->
                    requestStarted.countDown()
                    try {
                        awaitCancellation()
                    } finally {
                        requestCancelled.countDown()
                    }
                },
                scope,
            ),
        ).get(SignInViewModel::class.java)
        viewModel.onEvent(SignInEvent.UsernameChanged("anonymous-heron"))
        viewModel.onEvent(SignInEvent.PasswordChanged("fictional-password"))
        viewModel.onEvent(SignInEvent.Submit)
        assertTrue(requestStarted.await(1, TimeUnit.SECONDS))

        store.clear()

        assertTrue(requestCancelled.await(1, TimeUnit.SECONDS))
        assertEquals(SignInUiState(), viewModel.state.value)
        scope.cancel()
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

    private class OtherViewModel : androidx.lifecycle.ViewModel()
}
