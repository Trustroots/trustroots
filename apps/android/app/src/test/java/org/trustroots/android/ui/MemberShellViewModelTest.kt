package org.trustroots.android.ui

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.first
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberShellViewModelTest {
    @Test
    fun activityGraphStoreRetainsOneAccountAndClearsItsEntryStoresOnAccountChange() {
        val activityStore = ViewModelStore()
        val activityOwner = TestStoreOwner(activityStore)
        try {
            val graph = ViewModelProvider(activityOwner)[MemberShellViewModelStoreOwner::class.java]
            val firstAccount = graph.activateAccount("steady-heron")
            val firstMarker = ViewModelProvider(firstAccount)[StoreMarker::class.java]
            assertTrue(firstMarker === ViewModelProvider(graph.activateAccount("steady-heron"))[StoreMarker::class.java])

            val nextAccount = graph.activateAccount("quiet-fox")
            val nextMarker = ViewModelProvider(nextAccount)[StoreMarker::class.java]
            assertFalse(firstMarker === nextMarker)
            assertTrue(firstMarker.cleared)

            graph.clearAccount()
            assertTrue(nextMarker.cleared)
        } finally {
            activityStore.clear()
        }
    }


    @Test
    fun loadsAvatarAndRefreshesUnreadOnActiveVisitChangesAndResume() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val model = MemberShellViewModel(repository, scope)

        assertEquals("member-safe-id", model.state.value.avatarID)
        assertEquals(0, repository.unreadCalls)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(4))
        assertEquals(1, repository.unreadCalls)
        assertEquals(2, model.state.value.unreadMessageCount)

        model.onEvent(MemberShellEvent.ActiveVisitChanged(5))
        assertEquals(2, repository.unreadCalls)
        model.onEvent(MemberShellEvent.LifecycleChanged(false))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(6))
        assertEquals(2, repository.unreadCalls)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        assertEquals(3, repository.unreadCalls)
    }

    @Test
    fun repeatedActiveVisitAndLifecycleEventsDoNotDuplicateTheCurrentRefresh() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val model = MemberShellViewModel(repository, scope)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(12))
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(12))

        assertEquals(1, repository.unreadCalls)
        assertEquals(2, model.state.value.unreadMessageCount)
    }

    @Test
    fun ordinaryAvatarFailureCanBeRetriedAndUnexpectedExceptionsBecomeSafeFailures() = withScope { scope ->
        val repository = FakeMemberShellRepository().apply {
            avatarHandler = { call ->
                if (call == 1) Result.failure(IOException("Temporary avatar failure"))
                else Result.success("recovered-avatar")
            }
            unreadHandler = { throw IllegalStateException("Temporary unread failure") }
        }
        val model = MemberShellViewModel(repository, scope)

        assertEquals(MemberShellFailure(message = null, statusCode = null), model.state.value.failure)
        assertFalse(model.state.value.isAvatarLoading)
        model.onEvent(MemberShellEvent.RetryAvatar)
        assertEquals("recovered-avatar", model.state.value.avatarID)
        assertEquals(0, repository.unreadCalls)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(2))
        assertEquals(1, repository.unreadCalls)
        assertEquals(MemberShellFailure(message = null, statusCode = null), model.state.value.failure)
        assertFalse(model.state.value.isUnreadRefreshing)
    }

    @Test
    fun changedEnvironmentCancelsStaleResultsAndClearsPreviousAccountState() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val oldAvatar = CompletableDeferred<Result<String?>>()
        repository.avatarHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldAvatar.await() } else Result.success("new-avatar")
        }
        val staleUnread = CompletableDeferred<Result<Int>>()
        repository.unreadHandler = { call ->
            if (call == 1) withContext(NonCancellable) { staleUnread.await() } else Result.success(1)
        }
        val model = MemberShellViewModel(repository, scope)
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(1))

        repository.environmentChanged = true
        model.onEvent(MemberShellEvent.EnvironmentChanged(api(), session("new-session")))

        assertEquals(2, repository.avatarCalls)
        assertEquals(1, model.state.value.unreadMessageCount)
        assertEquals("new-avatar", model.state.value.avatarID)
        assertFalse(model.state.value.pendingSessionInvalidation != null)
        oldAvatar.complete(Result.success("stale-avatar"))
        staleUnread.complete(Result.success(88))
        assertEquals("new-avatar", model.state.value.avatarID)
        assertEquals(1, model.state.value.unreadMessageCount)
    }

    @Test
    fun ordinaryFailureIsTypedAndRetriedOnNextActiveVisit() = withScope { scope ->
        val repository = FakeMemberShellRepository().apply {
            unreadHandler = { call ->
                if (call == 1) Result.failure(MobileApiException(503, "Temporary outage", ApiFailureKind.REQUEST_REJECTED))
                else Result.success(3)
            }
        }
        val model = MemberShellViewModel(repository, scope)
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(1))
        assertEquals("Temporary outage", model.state.value.failure?.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, model.state.value.failure?.apiFailureKind)

        model.onEvent(MemberShellEvent.ActiveVisitChanged(2))
        assertEquals(3, model.state.value.unreadMessageCount)
        assertNull(model.state.value.failure)
    }

    @Test
    fun staleUnreadResponseFromPreviousVisitCannotReplaceCurrentCount() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val previousVisitResponse = CompletableDeferred<Result<Int>>()
        repository.unreadHandler = { call ->
            if (call == 1) withContext(NonCancellable) { previousVisitResponse.await() }
            else Result.success(4)
        }
        val model = MemberShellViewModel(repository, scope)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(1))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(2))
        assertEquals(2, repository.unreadCalls)
        assertEquals(4, model.state.value.unreadMessageCount)

        previousVisitResponse.complete(Result.success(91))

        assertEquals("A late response from the prior visit must not overwrite the current count", 4, model.state.value.unreadMessageCount)
        assertFalse(model.state.value.isUnreadRefreshing)
    }

    @Test
    fun synchronousUnreadReentryRejectsOldVisitSuccessAndAuthenticationFailure() = withScope { scope ->
        val staleResults = listOf(
            Result.success(91),
            Result.failure(MobileApiException(401, "Expired credentials")),
        )

        staleResults.forEach { staleResult ->
            val repository = FakeMemberShellRepository()
            lateinit var model: MemberShellViewModel
            repository.unreadHandler = { call ->
                when (call) {
                    1 -> {
                        // Unconfined starts this request inline, before the
                        // outer launch stores its Job in pollJob.
                        model.onEvent(MemberShellEvent.ActiveVisitChanged(2))
                        staleResult
                    }
                    else -> Result.success(4)
                }
            }
            model = MemberShellViewModel(repository, scope)
            model.onEvent(MemberShellEvent.LifecycleChanged(true))

            model.onEvent(MemberShellEvent.ActiveVisitChanged(1))

            assertEquals(2, repository.unreadCalls)
            assertEquals(4, model.state.value.unreadMessageCount)
            assertNull(model.state.value.pendingSessionInvalidation)
            assertFalse(model.state.value.isUnreadRefreshing)
        }
    }

    @Test
    fun authenticationFailureFromEitherLookupIsDeliveredOnce() = withScope { scope ->
        val repository = FakeMemberShellRepository().apply {
            avatarHandler = { Result.success("member-safe-id") }
            unreadHandler = { Result.failure(MobileApiException(401, "Expired")) }
        }
        val model = MemberShellViewModel(repository, scope)
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(1))
        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberShellEvent.InvalidationDelivered(pending.id))
        assertNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberShellEvent.ActiveVisitChanged(2))
        assertNull(model.state.value.pendingSessionInvalidation)
        assertEquals(1, repository.unreadCalls)
    }

    @Test
    fun avatarAuthenticationFailureUsesTheSameOneShotSessionInvalidation() = withScope { scope ->
        val repository = FakeMemberShellRepository().apply {
            avatarHandler = { Result.failure(MobileApiException(401, "Expired")) }
        }
        val model = MemberShellViewModel(repository, scope)
        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)

        model.onEvent(MemberShellEvent.InvalidationDelivered(pending.id))
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(1))
        model.onEvent(MemberShellEvent.RetryAvatar)

        assertNull(model.state.value.pendingSessionInvalidation)
        assertEquals(1, repository.avatarCalls)
        assertEquals(0, repository.unreadCalls)
    }

    @Test
    fun renewedCredentialsResetTheAuthenticationLatchAndStartFreshShellRequests() = withScope { scope ->
        val repository = FakeMemberShellRepository().apply {
            unreadHandler = { call ->
                if (call == 1) Result.failure(MobileApiException(401, "Expired"))
                else Result.success(4)
            }
        }
        val model = MemberShellViewModel(repository, scope)
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(1))
        val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberShellEvent.InvalidationDelivered(invalidation.id))
        repository.environmentChanged = true

        model.onEvent(MemberShellEvent.EnvironmentChanged(api(), session("connect.sid=renewed-fictional")))

        assertNull(model.state.value.pendingSessionInvalidation)
        assertEquals(4, model.state.value.unreadMessageCount)
        assertEquals(2, repository.unreadCalls)
    }

    @Test
    fun clearingTheNavigationEntryStoreCancelsInFlightAvatarAndUnreadWork() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val avatarResponse = CompletableDeferred<Result<String?>>()
        val unreadResponse = CompletableDeferred<Result<Int>>()
        val avatarCancelled = CompletableDeferred<Unit>()
        val unreadCancelled = CompletableDeferred<Unit>()
        repository.avatarHandler = {
            try { avatarResponse.await() } finally { avatarCancelled.complete(Unit) }
        }
        repository.unreadHandler = {
            try { unreadResponse.await() } finally { unreadCancelled.complete(Unit) }
        }
        val store = ViewModelStore()
        try {
            val model = ViewModelProvider(
                TestStoreOwner(store),
                MemberShellViewModel.Factory(repository, scope),
            )[MemberShellViewModel::class.java]
            model.onEvent(MemberShellEvent.LifecycleChanged(true))
            model.onEvent(MemberShellEvent.ActiveVisitChanged(1))
            assertTrue(model.state.value.isAvatarLoading)
            assertTrue(model.state.value.isUnreadRefreshing)

            store.clear()

            assertTrue(avatarCancelled.isCompleted)
            assertTrue(unreadCancelled.isCompleted)
            avatarResponse.complete(Result.success("late-avatar"))
            unreadResponse.complete(Result.success(99))
            assertEquals(MemberShellUiState(isAvatarLoading = false), model.state.value)
        } finally {
            store.clear()
        }
    }

    @Test
    fun productionRepositoryDoesNotReloadForANewClientWithTheSameBackend() = runBlocking {
        ShellApiServer().use { server ->
            val session = session()
            val api = MobileApiClient(server.baseURL)
            val repository = MobileApiMemberShellRepository(api, session)
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            val model = MemberShellViewModel(repository, scope)
            try {
                model.onEvent(MemberShellEvent.LifecycleChanged(true))
                model.onEvent(MemberShellEvent.ActiveVisitChanged(10))
                withTimeout(5_000) {
                    model.state.first { !it.isAvatarLoading && !it.isUnreadRefreshing }
                }
                assertEquals(2, server.requests.size)
                assertFalse(repository.updateEnvironment(MobileApiClient(server.baseURL), session))
                model.onEvent(MemberShellEvent.EnvironmentChanged(MobileApiClient(server.baseURL), session))
                assertEquals(2, server.requests.size)
                assertTrue(repository.updateEnvironment(MobileApiClient("https://other.example"), session))
            } finally {
                scope.cancel()
            }
        }
    }

    @Test
    fun productionRepositoryDetectsBackendCookieAndAccountIdentityChanges() {
        val originalApi = MobileApiClient("https://api.example.test/")
        val originalSession = session()
        val repository = MobileApiMemberShellRepository(originalApi, originalSession)

        assertFalse(repository.updateEnvironment(MobileApiClient("https://api.example.test"), originalSession))
        assertTrue(repository.updateEnvironment(MobileApiClient("https://other.example.test"), originalSession))
        assertFalse(repository.updateEnvironment(MobileApiClient("https://other.example.test/"), originalSession))
        assertTrue(repository.updateEnvironment(
            MobileApiClient("https://other.example.test"), session("connect.sid=refreshed-fictional"),
        ))
        assertTrue(repository.updateEnvironment(
            MobileApiClient("https://other.example.test"),
            MemberSession("connect.sid=refreshed-fictional", MobileMember("calm-lynx", "Calm Lynx")),
        ))
        assertFalse(repository.updateEnvironment(
            MobileApiClient("https://other.example.test"),
            MemberSession("connect.sid=refreshed-fictional", MobileMember("calm-lynx", "Calm Lynx")),
        ))
    }

    @Test
    fun periodicPollingContinuesAtItsCadenceAndPauseCancelsThePendingInterval() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val delayCalls = mutableListOf<CompletableDeferred<Unit>>()
        val model = MemberShellViewModel(repository, scope) {
            CompletableDeferred<Unit>().also(delayCalls::add).await()
        }
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(3))
        assertEquals(1, repository.unreadCalls)
        assertEquals(1, delayCalls.size)

        delayCalls.single().complete(Unit)
        assertEquals(2, repository.unreadCalls)
        assertEquals(2, delayCalls.size)
        model.onEvent(MemberShellEvent.LifecycleChanged(false))
        delayCalls[1].complete(Unit)
        assertEquals(2, repository.unreadCalls)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        assertEquals(3, repository.unreadCalls)
    }

    @Test
    fun explicitUnreadRefreshCancelsTheOldIntervalAndRefreshesImmediately() = withScope { scope ->
        val repository = FakeMemberShellRepository()
        val delayCalls = mutableListOf<CompletableDeferred<Unit>>()
        val model = MemberShellViewModel(repository, scope) {
            CompletableDeferred<Unit>().also(delayCalls::add).await()
        }
        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(7))
        assertEquals(1, repository.unreadCalls)
        assertEquals(1, delayCalls.size)

        model.onEvent(MemberShellEvent.RefreshUnread)

        assertEquals(2, repository.unreadCalls)
        assertEquals(2, delayCalls.size)
        delayCalls[0].complete(Unit)
        assertEquals("The cancelled poll interval must not issue another request", 2, repository.unreadCalls)
        delayCalls[1].complete(Unit)
        assertEquals(3, repository.unreadCalls)
    }

    private fun withScope(test: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try { test(scope) } finally { scope.cancel() }
    }

    private fun api() = MobileApiClient("https://example.invalid")
    private fun session(cookie: String = "connect.sid=fictional") =
        MemberSession(cookie, MobileMember("quiet-heron", "Quiet Heron"))

    private class FakeMemberShellRepository : MemberShellRepository {
        var environmentChanged = false
        var avatarCalls = 0
        var unreadCalls = 0
        var avatarHandler: suspend (Int) -> Result<String?> = { Result.success("member-safe-id") }
        var unreadHandler: suspend (Int) -> Result<Int> = { Result.success(2) }

        override fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean {
            val changed = environmentChanged
            environmentChanged = false
            return changed
        }

        override suspend fun ownAvatarID(): Result<String?> {
            return avatarHandler(++avatarCalls)
        }

        override suspend fun unreadCount(): Result<Int> = unreadHandler(++unreadCalls)
    }

    class StoreMarker : androidx.lifecycle.ViewModel() {
        var cleared = false
        override fun onCleared() { cleared = true }
    }

    private class TestStoreOwner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class ShellApiServer : AutoCloseable {
        private val server = ServerSocket(0)
        val requests = CopyOnWriteArrayList<String>()
        val baseURL = "http://127.0.0.1:${server.localPort}"
        private val worker = thread(isDaemon = true) {
            repeat(2) {
                server.accept().use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    val path = request.substringAfter(' ').substringBefore(' ')
                    requests += request
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val body = if (path.startsWith("/api/users/")) {
                        """{"_id":"member-safe-id","username":"quiet-heron","displayName":"Quiet Heron"}"""
                    } else "[]"
                    val bytes = body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }

        override fun close() {
            server.close()
            worker.join(TimeUnit.SECONDS.toMillis(2))
        }
    }
}
