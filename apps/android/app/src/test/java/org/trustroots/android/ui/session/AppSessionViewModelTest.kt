package org.trustroots.android.ui.session

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.ViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.UiFailureFallback

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class AppSessionViewModelTest {
    @Test
    fun restoreRunsOnceAndPreservesTheMinimumStartupDurationAndWelcomeName() = withScope { scope ->
        var now = 1_000L
        val operations = FakeOperations().apply { restoredSession = session() }
        val waits = mutableListOf<Long>()
        val model = AppSessionViewModel(
            operations = operations,
            scope = scope,
            ioDispatcher = Dispatchers.Unconfined,
            elapsedRealtime = { now },
            wait = { millis -> waits += millis; now += millis },
        )

        assertFalse(model.state.value.isStarting)
        assertEquals(session(), model.state.value.session)
        assertEquals("Quiet", model.state.value.startupFirstName)
        assertEquals(1, operations.loadCalls)
        assertEquals(listOf(700L), waits)
    }

    @Test
    fun restoredNameIsAvailableOnStartupWhileTheMinimumDelayIsStillRunning() = withScope { scope ->
        val finishMinimumDelay = CompletableDeferred<Unit>()
        val operations = FakeOperations().apply { restoredSession = session() }
        val model = AppSessionViewModel(
            operations = operations,
            scope = scope,
            ioDispatcher = Dispatchers.Unconfined,
            elapsedRealtime = { 0L },
            wait = { finishMinimumDelay.await() },
        )

        assertTrue(model.state.value.isStarting)
        assertEquals("Quiet", model.state.value.startupFirstName)

        finishMinimumDelay.complete(Unit)

        assertFalse(model.state.value.isStarting)
        assertEquals(session(), model.state.value.session)
    }

    @Test
    fun anEmptyStoreFinishesStartupInTheSignedOutState() = withScope { scope ->
        val operations = FakeOperations()
        val model = settledModel(scope, operations)

        assertFalse(model.state.value.isStarting)
        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertEquals(1, operations.loadCalls)
    }

    @Test
    fun restoreThatTakesLongerThanTheMinimumDoesNotAddAnotherDelay() = withScope { scope ->
        var now = 2_000L
        val operations = FakeOperations().apply {
            loadAction = { now = 2_900L; session() }
        }
        val waits = mutableListOf<Long>()
        val model = AppSessionViewModel(
            operations = operations,
            scope = scope,
            ioDispatcher = Dispatchers.Unconfined,
            elapsedRealtime = { now },
            wait = { waits += it },
        )

        assertFalse(model.state.value.isStarting)
        assertTrue(waits.isEmpty())
        assertEquals(session(), model.state.value.session)
    }

    @Test
    fun sessionStateAndCallbackDiagnosticsRedactTheCookie() {
        val memberSession = session("connect.sid=do-not-log-this")
        val stateText = AppSessionUiState(isStarting = false, session = memberSession).toString()
        val eventText = AppSessionEvent.SignedIn(memberSession, "https://example.invalid").toString()
        val sourceText = AppSessionSource.from(memberSession, "https://example.invalid").toString()

        assertFalse(stateText.contains(memberSession.cookieHeader))
        assertFalse(eventText.contains(memberSession.cookieHeader))
        assertFalse(sourceText.contains(memberSession.cookieHeader))
    }

    @Test
    fun backendChangeNormalisesTheActiveIdentityBeforeAcceptingSignIn() = withScope { scope ->
        val operations = FakeOperations()
        val model = settledModel(scope, operations, "https://first.example.invalid")
        val signedIn = session("connect.sid=backend-switch-session")

        model.onEvent(AppSessionEvent.BackendChanged(" https://second.example.invalid/ "))
        model.onEvent(AppSessionEvent.SignedIn(signedIn, "https://first.example.invalid"))
        assertNull(model.state.value.session)
        assertTrue(operations.events.isEmpty())

        model.onEvent(AppSessionEvent.SignedIn(signedIn, "https://second.example.invalid/"))
        assertEquals(signedIn, model.state.value.session)
        assertEquals(listOf("save:quiet-heron", "clear-sign-in"), operations.events)
    }

    @Test
    fun sessionFactoryRejectsUnrelatedViewModelTypes() {
        val factory = AppSessionViewModel.Factory(FakeOperations())
        val failure = runCatching { factory.create(OtherViewModel::class.java) }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }

    @Test
    fun signInPersistsBeforePublishingAndClearsTheSignInDestination() = withScope { scope ->
        val operations = FakeOperations()
        val model = settledModel(scope, operations)
        operations.events.clear()

        model.onEvent(AppSessionEvent.SignedIn(session(), ""))

        assertEquals(listOf("save:quiet-heron", "clear-sign-in"), operations.events)
        assertEquals(session(), model.state.value.session)
        assertFalse(model.state.value.isStarting)
        assertNull(model.state.value.signedOutMessage)
    }

    @Test
    fun memberUpdateSavesTheNewMemberWhileRetainingTheCookie() = withScope { scope ->
        val operations = FakeOperations().apply { restoredSession = session() }
        val model = settledModel(scope, operations)
        val updatedMember = MobileMember("quiet-heron", "Quiet Heron Updated")
        operations.events.clear()

        model.onEvent(AppSessionEvent.MemberUpdated(AppSessionSource.from(session(), ""), updatedMember))

        assertEquals(listOf("save:quiet-heron"), operations.events)
        assertEquals("connect.sid=fictional-session", model.state.value.session?.cookieHeader)
        assertEquals(updatedMember, model.state.value.session?.member)
    }

    @Test
    fun callbacksForThePreviousUsernameCannotClearTheUpdatedAccount() = withScope { scope ->
        val backendURL = "https://example.invalid"
        val originalSession = session()
        val operations = FakeOperations().apply { restoredSession = originalSession }
        val model = settledModel(scope, operations, backendURL)
        val originalSource = AppSessionSource.from(originalSession, backendURL)
        val updatedMember = MobileMember("updated-quiet-heron", "Quiet Heron")
        model.onEvent(AppSessionEvent.MemberUpdated(originalSource, updatedMember))
        operations.events.clear()

        model.onEvent(AppSessionEvent.SignedOut(originalSource))

        assertEquals(originalSession.cookieHeader, model.state.value.session?.cookieHeader)
        assertEquals(updatedMember, model.state.value.session?.member)
        assertTrue(operations.events.isEmpty())
    }

    @Test
    fun signOutClearsCacheStoreAndBothRouteOwnersBeforePublishingSignedOut() = withScope { scope ->
        val backendURL = " https://example.invalid/ "
        val operations = FakeOperations().apply { restoredSession = session() }
        val model = settledModel(scope, operations, backendURL)
        operations.events.clear()

        model.onEvent(AppSessionEvent.SignedOut(AppSessionSource.from(session(), backendURL)))

        assertEquals(
            listOf(
                "cache:https://example.invalid:quiet-heron",
                "clear-session",
                "clear-sign-in",
                "clear-shell",
            ),
            operations.events,
        )
        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertFalse(model.state.value.isStarting)
    }

    @Test
    fun invalidationUsesTheSameCleanupAndPublishesOnlyTheExistingExpiredFeedback() = withScope { scope ->
        val backendURL = "https://example.invalid"
        val operations = FakeOperations().apply { restoredSession = session() }
        val model = settledModel(scope, operations, backendURL)
        operations.events.clear()

        model.onEvent(AppSessionEvent.SessionInvalidated(AppSessionSource.from(session(), backendURL)))

        assertEquals(
            listOf(
                "cache:https://example.invalid:quiet-heron",
                "clear-session",
                "clear-sign-in",
                "clear-shell",
            ),
            operations.events,
        )
        assertNull(model.state.value.session)
        assertEquals(UiFailureFallback.SESSION_EXPIRED, model.state.value.signedOutMessage?.fallback)
    }

    @Test
    fun aLateRestoreCannotReplaceASessionSignedInDuringAnOutstandingRestore() = withScope { scope ->
        val releaseRestore = CompletableDeferred<MemberSession?>()
        val operations = FakeOperations().apply {
            loadAction = { releaseRestore.await() }
        }
        val model = AppSessionViewModel(
            operations = operations,
            scope = scope,
            ioDispatcher = Dispatchers.Unconfined,
            elapsedRealtime = { 0L },
            wait = {},
        )
        assertTrue(model.state.value.isStarting)

        model.onEvent(AppSessionEvent.SignedIn(session("connect.sid=new-fictional-session"), ""))
        releaseRestore.complete(session("connect.sid=old-fictional-session"))

        assertEquals("connect.sid=new-fictional-session", model.state.value.session?.cookieHeader)
        assertFalse(model.state.value.isStarting)
    }

    @Test
    fun staleInvalidationAndLogoutFromAnOldCookieCannotClearANewSession() = withScope { scope ->
        val backendURL = "https://example.invalid"
        val oldSession = session()
        val newSession = session("connect.sid=new-fictional-session", username = "new-quiet-heron")
        val operations = FakeOperations().apply { restoredSession = oldSession }
        val model = settledModel(scope, operations, backendURL)
        val oldSource = AppSessionSource.from(oldSession, backendURL)
        model.onEvent(AppSessionEvent.SignedIn(newSession, backendURL))
        operations.events.clear()

        model.onEvent(AppSessionEvent.SessionInvalidated(oldSource))
        model.onEvent(AppSessionEvent.SignedOut(oldSource))
        model.onEvent(AppSessionEvent.MemberUpdated(oldSource, MobileMember("quiet-heron", "Stale Name")))

        assertEquals(newSession, model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertTrue(operations.events.isEmpty())
    }

    @Test
    fun duplicateOldLogoutAfterANewSignInDoesNotClearTheNewAccount() = withScope { scope ->
        val backendURL = "https://example.invalid"
        val oldSession = session()
        val newSession = session("connect.sid=new-fictional-session")
        val operations = FakeOperations().apply { restoredSession = oldSession }
        val model = settledModel(scope, operations, backendURL)
        val oldSource = AppSessionSource.from(oldSession, backendURL)

        model.onEvent(AppSessionEvent.SignedOut(oldSource))
        model.onEvent(AppSessionEvent.SignedIn(newSession, backendURL))
        operations.events.clear()
        model.onEvent(AppSessionEvent.SignedOut(oldSource))

        assertEquals(newSession, model.state.value.session)
        assertTrue(operations.events.isEmpty())
    }

    @Test
    fun delayedInvalidationAfterExplicitSignOutDoesNotShowExpiryFeedbackAgain() = withScope { scope ->
        val backendURL = "https://example.invalid"
        val oldSession = session()
        val operations = FakeOperations().apply { restoredSession = oldSession }
        val model = settledModel(scope, operations, backendURL)
        val oldSource = AppSessionSource.from(oldSession, backendURL)

        model.onEvent(AppSessionEvent.SignedOut(oldSource))
        operations.events.clear()
        model.onEvent(AppSessionEvent.SessionInvalidated(oldSource))

        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertTrue(operations.events.isEmpty())
    }

    @Test
    fun clearingTheActivityViewModelDropsRuntimeSessionAndFeedbackWithoutClearingStore() = withScope { scope ->
        val operations = FakeOperations()
        val store = ViewModelStore()
        val model = ViewModelProvider(
            TestStoreOwner(store),
            AppSessionViewModel.Factory(
                operations = operations,
                scope = scope,
                ioDispatcher = Dispatchers.Unconfined,
                elapsedRealtime = { 700L },
                wait = {},
            ),
        )[AppSessionViewModel::class.java]
        model.onEvent(AppSessionEvent.SignedIn(session(), ""))
        val operationsBeforeClear = operations.events.toList()

        store.clear()

        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertEquals(operationsBeforeClear, operations.events)

        val source = AppSessionSource.from(session(), "")
        model.onEvent(AppSessionEvent.SignedIn(session("connect.sid=late-session"), ""))
        model.onEvent(AppSessionEvent.BackendChanged("https://late-backend.invalid"))
        model.onEvent(AppSessionEvent.MemberUpdated(source, MobileMember("quiet-heron", "Late Name")))
        model.onEvent(AppSessionEvent.SignedOut(source))
        model.onEvent(AppSessionEvent.SessionInvalidated(source))

        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertFalse(model.state.value.isStarting)
        assertEquals(operationsBeforeClear, operations.events)
    }

    @Test
    fun clearingTheActivityViewModelDropsExpiredFeedbackWithoutClearingTheStoreAgain() = withScope { scope ->
        val backendURL = "https://example.invalid"
        val oldSession = session()
        val operations = FakeOperations().apply { restoredSession = oldSession }
        val store = ViewModelStore()
        val model = ViewModelProvider(
            TestStoreOwner(store),
            AppSessionViewModel.Factory(
                operations = operations,
                initialBackendURL = backendURL,
                scope = scope,
                ioDispatcher = Dispatchers.Unconfined,
                elapsedRealtime = { 700L },
                wait = {},
            ),
        )[AppSessionViewModel::class.java]
        model.onEvent(AppSessionEvent.SessionInvalidated(AppSessionSource.from(oldSession, backendURL)))
        assertEquals(UiFailureFallback.SESSION_EXPIRED, model.state.value.signedOutMessage?.fallback)
        val operationsBeforeClear = operations.events.toList()

        store.clear()

        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertEquals(operationsBeforeClear, operations.events)
    }

    @Test
    fun lateRestoreAfterActivityViewModelClearCannotRepublishTheSession() = withScope { scope ->
        val lateRestore = CompletableDeferred<MemberSession?>()
        val operations = FakeOperations().apply { loadAction = { lateRestore.await() } }
        val store = ViewModelStore()
        val model = ViewModelProvider(
            TestStoreOwner(store),
            AppSessionViewModel.Factory(
                operations = operations,
                scope = scope,
                ioDispatcher = Dispatchers.Unconfined,
                elapsedRealtime = { 0L },
                wait = {},
            ),
        )[AppSessionViewModel::class.java]
        assertTrue(model.state.value.isStarting)

        store.clear()
        lateRestore.complete(session())

        assertNull(model.state.value.session)
        assertNull(model.state.value.signedOutMessage)
        assertFalse(model.state.value.isStarting)
        assertFalse(operations.events.contains("clear-session"))
    }

    @Test
    fun callbackFromAnOldBackendCannotSignOutTheCurrentSession() = withScope { scope ->
        val existingSession = session()
        val operations = FakeOperations().apply { restoredSession = existingSession }
        val model = settledModel(scope, operations, "https://new-backend.invalid")
        operations.events.clear()

        model.onEvent(AppSessionEvent.SignedOut(AppSessionSource.from(existingSession, "https://old-backend.invalid")))
        model.onEvent(AppSessionEvent.SignedIn(session("connect.sid=stale-backend-session"), "https://old-backend.invalid"))

        assertEquals(existingSession, model.state.value.session)
        assertTrue(operations.events.isEmpty())
    }

    private fun settledModel(
        scope: CoroutineScope,
        operations: FakeOperations,
        backendURL: String = "",
    ): AppSessionViewModel =
        AppSessionViewModel(
            operations = operations,
            initialBackendURL = backendURL,
            scope = scope,
            ioDispatcher = Dispatchers.Unconfined,
            elapsedRealtime = { 700L },
            wait = {},
        )

    private fun withScope(test: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try { test(scope) } finally { scope.cancel() }
    }

    private fun session(
        cookie: String = "connect.sid=fictional-session",
        username: String = "quiet-heron",
    ) = MemberSession(cookie, MobileMember(username, "Quiet Heron"))

    private class FakeOperations : AppSessionOperations {
        var restoredSession: MemberSession? = null
        var loadAction: suspend () -> MemberSession? = { restoredSession }
        var loadCalls = 0
        val events = mutableListOf<String>()

        override suspend fun loadSession(): MemberSession? {
            loadCalls++
            return loadAction()
        }

        override fun saveSession(session: MemberSession) {
            events += "save:${session.member.username}"
        }

        override fun clearSession() {
            events += "clear-session"
        }

        override fun clearResponseCache(backendURL: String, username: String) {
            events += "cache:$backendURL:$username"
        }

        override fun clearSignInDestination() {
            events += "clear-sign-in"
        }

        override fun clearShellAccount() {
            events += "clear-shell"
        }
    }

    private class TestStoreOwner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class OtherViewModel : ViewModel()
}
