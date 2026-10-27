package org.trustroots.android.ui.inbox

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
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class InboxViewModelTest {
    @Test
    fun firstDisplayPreservesAnImmediateFailureAndLaterDisplayRefreshes() = withScope { scope ->
        var calls = 0
        val repository = FakeInboxRepository {
            calls++
            Result.failure(MobileApiException(503, serverMessage = "Fictional inbox unavailable."))
        }
        val model = InboxViewModel(repository, session(), scope)

        model.onDisplayed()
        assertEquals(1, calls)
        assertEquals("Fictional inbox unavailable.", model.state.value.failure?.serverMessage)

        model.onDisplayed()
        assertEquals(2, calls)
    }

    @Test
    fun newVisitReusesFreshDataWithoutSharingFilterOrRequestState() = withScope { scope ->
        val cache = InboxCache()
        val repository = FakeInboxRepository { Result.success(listOf(thread("saved", "Quiet Fox"))) }
        val first = InboxViewModel(repository, session(), scope, now = { 0L }, cache = cache)
        first.onEvent(InboxEvent.FilterChanged("Quiet"))
        val next = InboxViewModel(repository, session(), scope, now = { 29_999L }, cache = cache)
        assertEquals(listOf(1), repository.pages)
        assertEquals("saved", next.state.value.threads.single().id)
        assertEquals("", next.state.value.filter)
        assertTrue(next.state.value.hasLoaded)
        assertFalse(next.state.value.isLoading)

        InboxViewModel(repository, session(), scope, now = { 30_000L }, cache = cache)
        assertEquals(listOf(1, 1), repository.pages)
    }

    @Test
    fun reopeningKeepsFreshInboxAndRefreshesStaleDataWithoutInitialLoadingState() = withScope { scope ->
        var now = 0L
        val pending = CompletableDeferred<Result<List<MessageThread>>>()
        var calls = 0
        val repository = FakeInboxRepository {
            if (calls++ == 0) Result.success(listOf(thread("old", "Quiet Fox"))) else pending.await()
        }
        val model = InboxViewModel(repository, session(), scope, now = { now })
        now = 29_999L
        model.onEvent(InboxEvent.Opened)
        assertEquals(1, calls)
        now = 30_000L
        model.onEvent(InboxEvent.Opened)
        assertEquals(2, calls)
        assertTrue(model.state.value.hasLoaded)
        assertTrue(model.state.value.isLoading)
        assertEquals("old", model.state.value.threads.single().id)
        model.onEvent(InboxEvent.Opened)
        assertEquals(2, calls)
        pending.complete(Result.success(listOf(thread("new", "Quiet Fox"))))
        assertEquals("new", model.state.value.threads.single().id)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun returningFromConversationRefreshesEvenFreshInboxWithoutHidingIt() = withScope { scope ->
        var calls = 0
        val pending = CompletableDeferred<Result<List<MessageThread>>>()
        val repository = FakeInboxRepository {
            if (calls++ == 0) Result.success(emptyList()) else pending.await()
        }
        val model = InboxViewModel(repository, session(), scope, now = { 0L })
        model.onEvent(InboxEvent.ReturnFromConversation)
        assertEquals(2, calls)
        assertTrue(model.state.value.hasLoaded)
        pending.complete(Result.success(emptyList()))
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun loadsPagesAndDeduplicatesThreadsAndFilteringLivesInState() = withScope { scope ->
        val repository = FakeInboxRepository { page ->
            when (page) {
                1 -> Result.success((0..49).map { thread("thread-$it", "Neighbour $it") })
                2 -> Result.success(listOf(thread("thread-49", "Neighbour 49"), thread("thread-50", "Quiet Fox")))
                else -> error("Unexpected page $page")
            }
        }
        val model = InboxViewModel(repository, session(), scope)

        assertEquals(listOf(1, 2), repository.pages)
        assertEquals(51, model.state.value.threads.size)
        assertEquals(listOf("thread-49", "thread-50"), model.state.value.threads.takeLast(2).map(MessageThread::id))
        assertTrue(model.state.value.hasLoaded)
        assertFalse(model.state.value.isLoading)

        model.onEvent(InboxEvent.FilterChanged("  QUIET "))

        assertEquals(listOf("thread-50"), model.state.value.visibleThreads.map(MessageThread::id))
    }

    @Test
    fun retryDuringAnActivePageRequestDoesNotDuplicateIt() = withScope { scope ->
        val pendingPage = CompletableDeferred<Result<List<MessageThread>>>()
        val repository = FakeInboxRepository { withContext(NonCancellable) { pendingPage.await() } }
        val model = InboxViewModel(repository, session(), scope)

        model.onEvent(InboxEvent.Retry)

        assertEquals(listOf(1), repository.pages)
        assertTrue(model.state.value.isLoading)
        pendingPage.complete(Result.success(listOf(thread("current-thread", "Current Owl"))))

        assertEquals(listOf(1), repository.pages)
        assertEquals(listOf("current-thread"), model.state.value.threads.map(MessageThread::id))
        assertTrue(model.state.value.hasLoaded)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun emptyPageAfterAFullPageEndsPaginationWithoutAnotherRequest() = withScope { scope ->
        val repository = FakeInboxRepository { page ->
            if (page == 1) Result.success((0..49).map { thread("thread-$it", "Neighbour $it") })
            else Result.success(emptyList())
        }
        val model = InboxViewModel(repository, session(), scope)

        assertEquals(listOf(1, 2), repository.pages)
        assertEquals(50, model.state.value.threads.size)
        assertEquals(3, model.state.value.nextPage)
        assertTrue(model.state.value.hasLoaded)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun laterPageFailureKeepsLoadedRowsAndRetryResumesAtFailedPage() = withScope { scope ->
        var pageTwoAttempts = 0
        val repository = FakeInboxRepository { page ->
            when (page) {
                1 -> Result.success((0..49).map { thread("thread-$it", "Neighbour $it") })
                2 -> if (pageTwoAttempts++ == 0) {
                    Result.failure(MobileApiException(503, serverMessage = "A fictional page failure."))
                } else {
                    Result.success(listOf(thread("thread-50", "Quiet Fox")))
                }
                else -> error("Unexpected page $page")
            }
        }
        val model = InboxViewModel(repository, session(), scope)

        assertEquals(50, model.state.value.threads.size)
        assertEquals(2, model.state.value.failedPage)
        assertEquals("A fictional page failure.", model.state.value.failure?.serverMessage)
        assertFalse(model.state.value.isLoading)

        model.onEvent(InboxEvent.Retry)

        assertEquals(listOf(1, 2, 2), repository.pages)
        assertEquals(51, model.state.value.threads.size)
        assertNull(model.state.value.failure)
        assertNull(model.state.value.failedPage)
        assertTrue(model.state.value.hasLoaded)
    }

    @Test
    fun authFailureIsAcknowledgedOnceUntilCredentialsChange() = withScope { scope ->
        var calls = 0
        val repository = FakeInboxRepository {
            calls++
            if (calls == 1) Result.failure(MobileApiException(401, "Fictional session expired."))
            else Result.success(listOf(thread("thread-one", "Quiet Fox")))
        }
        val model = InboxViewModel(repository, session(), scope)
        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)

        model.onEvent(InboxEvent.SessionInvalidationDelivered(pending.id + 1))
        model.onEvent(InboxEvent.Retry)
        assertEquals(1, calls)
        assertEquals(pending, model.state.value.pendingSessionInvalidation)

        model.onEvent(InboxEvent.SessionInvalidationDelivered(pending.id))
        model.onEvent(InboxEvent.Retry)
        assertEquals(1, calls)
        model.onEvent(InboxEvent.SessionChanged(session("renewed-fictional-session")))

        assertEquals(2, calls)
        assertNull(model.state.value.pendingSessionInvalidation)
        assertEquals(1, model.state.value.threads.size)
    }

    @Test
    fun returnRefreshRejectsLateResponseFromPreviousLoad() = withScope { scope ->
        val oldResponse = CompletableDeferred<Result<List<MessageThread>>>()
        var callCount = 0
        val repository = FakeInboxRepository { page ->
            callCount++
            if (callCount == 1) withContext(NonCancellable) { oldResponse.await() }
            else Result.success(listOf(thread("current-thread", "Current Owl")))
        }
        val model = InboxViewModel(repository, session(), scope)
        assertTrue(model.state.value.isLoading)

        model.onEvent(InboxEvent.ReturnFromConversation)
        assertEquals(listOf("current-thread"), model.state.value.threads.map(MessageThread::id))
        oldResponse.complete(Result.success(listOf(thread("stale-thread", "Stale Fox"))))

        assertEquals(listOf("current-thread"), model.state.value.threads.map(MessageThread::id))
        assertEquals(listOf(1, 1), repository.pages)
    }

    @Test
    fun renewedSessionCancelsOldRequestAndRejectsItsLateRows() = withScope { scope ->
        val oldResponse = CompletableDeferred<Result<List<MessageThread>>>()
        var callCount = 0
        val repository = FakeInboxRepository { _ ->
            callCount++
            if (callCount == 1) withContext(NonCancellable) { oldResponse.await() }
            else Result.success(listOf(thread("current-thread", "Current Owl")))
        }
        val model = InboxViewModel(repository, session(), scope)

        model.onEvent(InboxEvent.SessionChanged(session("renewed-fictional-session")))
        assertEquals(listOf("current-thread"), model.state.value.threads.map(MessageThread::id))
        oldResponse.complete(Result.success(listOf(thread("old-account-thread", "Old Fox"))))

        assertEquals(listOf("current-thread"), model.state.value.threads.map(MessageThread::id))
        assertFalse(model.state.value.toString().contains("renewed-fictional-session"))
    }

    @Test
    fun recreatedClientForSameBackendKeepsLoadedInboxAndFilter() = withScope { scope ->
        val repository = FakeInboxRepository { Result.success(listOf(thread("thread-one", "Quiet Fox"))) }
        val model = InboxViewModel(repository, session(), scope)
        model.onEvent(InboxEvent.FilterChanged("quiet"))
        val recreatedClient = MobileApiClient("http://127.0.0.1:1")

        model.updateApi(recreatedClient)

        assertSame(recreatedClient, repository.currentApi)
        assertEquals(listOf(1), repository.pages)
        assertEquals("quiet", model.state.value.filter)
        assertEquals(listOf("thread-one"), model.state.value.threads.map(MessageThread::id))
    }

    @Test
    fun credentialRefreshKeepsFilterWhileAccountAndBackendChangesReloadTheInbox() = withScope { scope ->
        val repository = FakeInboxRepository { page -> Result.success(listOf(thread("thread-$page", "Quiet Fox"))) }
        val firstApi = MobileApiClient("http://127.0.0.1:1")
        repository.updateApi(firstApi)
        val model = InboxViewModel(repository, session(), scope)
        model.onEvent(InboxEvent.FilterChanged("quiet"))

        model.onEvent(InboxEvent.SessionChanged(session("connect.sid=refreshed-fictional-session")))

        assertEquals("quiet", model.state.value.filter)
        assertEquals(listOf(1, 1), repository.pages)

        model.onEvent(InboxEvent.SessionChanged(session("connect.sid=new-account-session", "calm-lynx")))

        assertEquals("", model.state.value.filter)
        assertEquals(listOf(1, 1, 1), repository.pages)

        model.updateApi(MobileApiClient("http://127.0.0.1:2"))

        assertEquals(listOf(1, 1, 1, 1), repository.pages)
        assertEquals(listOf("thread-1"), model.state.value.threads.map(MessageThread::id))
    }

    @Test
    fun identicalSessionChangeDoesNotReloadOrDiscardInboxState() = withScope { scope ->
        val repository = FakeInboxRepository { Result.success(listOf(thread("thread-one", "Quiet Fox"))) }
        val currentSession = session()
        val model = InboxViewModel(repository, currentSession, scope)
        model.onEvent(InboxEvent.FilterChanged("quiet"))

        model.onEvent(InboxEvent.SessionChanged(currentSession))

        assertEquals(listOf(1), repository.pages)
        assertEquals("quiet", model.state.value.filter)
        assertEquals(listOf("thread-one"), model.state.value.threads.map(MessageThread::id))
    }

    @Test
    fun visibleThreadsSearchesUsernameAndExcerptWhenDisplayNameIsBlank() = withScope { scope ->
        val repository = FakeInboxRepository {
            Result.success(
                listOf(
                    MessageThread(
                        id = "thread-one",
                        otherMember = MessageMember("member-one", "quiet-fox", ""),
                        excerpt = "A note about the mountains.",
                        read = false,
                    ),
                    MessageThread(
                        id = "thread-two",
                        otherMember = MessageMember("member-two", null, ""),
                        excerpt = "A note about the valley.",
                        read = false,
                    ),
                ),
            )
        }
        val model = InboxViewModel(repository, session(), scope)

        model.onEvent(InboxEvent.FilterChanged("QUIET-FOX"))

        assertEquals(listOf("thread-one"), model.state.value.visibleThreads.map(MessageThread::id))
        model.onEvent(InboxEvent.FilterChanged("mountains"))
        assertEquals(listOf("thread-one"), model.state.value.visibleThreads.map(MessageThread::id))
        model.onEvent(InboxEvent.FilterChanged("valley"))
        assertEquals(listOf("thread-two"), model.state.value.visibleThreads.map(MessageThread::id))
    }

    @Test
    fun thrownPageFailureCanBeRetriedAtTheFailedPage() = withScope { scope ->
        var attempts = 0
        val repository = FakeInboxRepository { page ->
            if (attempts++ == 0) throw IllegalStateException("A fictional connection failure.")
            assertEquals(1, page)
            Result.success(listOf(thread("thread-one", "Quiet Fox")))
        }
        val model = InboxViewModel(repository, session(), scope)

        assertEquals(1, model.state.value.failedPage)
        assertFalse(model.state.value.isLoading)
        assertTrue(model.state.value.failure != null)

        model.onEvent(InboxEvent.Retry)

        assertEquals(listOf(1, 1), repository.pages)
        assertEquals(listOf("thread-one"), model.state.value.threads.map(MessageThread::id))
        assertTrue(model.state.value.hasLoaded)
        assertNull(model.state.value.failure)
    }

    @Test
    fun repositoryDistinguishesBackendChangeFromNewClientInstance() {
        val originalSession = session()
        val repository = MobileApiInboxRepository(
            MobileApiClient("http://127.0.0.1:1"), originalSession,
        )

        assertFalse(repository.updateApi(MobileApiClient("http://127.0.0.1:1")))
        assertTrue(repository.updateApi(MobileApiClient("http://127.0.0.1:2")))
        assertFalse(repository.updateSession(originalSession))
        assertTrue(repository.updateSession(session("connect.sid=refreshed-fictional-session")))
        assertTrue(repository.updateSession(session("connect.sid=refreshed-fictional-session", "calm-lynx")))
        assertFalse(repository.updateSession(session("connect.sid=refreshed-fictional-session", "calm-lynx")))
    }

    @Test
    fun removingTheOwningEntryCancelsWorkAndClearsItsState() = withScope { scope ->
        val store = ViewModelStore()
        val response = CompletableDeferred<Result<List<MessageThread>>>()
        val cancelled = CompletableDeferred<Unit>()
        val repository = FakeInboxRepository {
            try {
                response.await()
            } finally {
                cancelled.complete(Unit)
            }
        }
        try {
            val model = ViewModelProvider(
                StoreOwner(store),
                InboxViewModel.Factory(repository, session(), scope),
            )[InboxViewModel::class.java]
            assertTrue(model.state.value.isLoading)

            store.clear()

            assertTrue(cancelled.isCompleted)
            assertEquals(InboxUiState(), model.state.value)
        } finally {
            store.clear()
        }
    }

    private class FakeInboxRepository(
        private val pageHandler: suspend (Int) -> Result<List<MessageThread>>,
    ) : InboxRepository {
        val pages = mutableListOf<Int>()
        var currentApi: MobileApiClient? = null
        override fun updateApi(api: MobileApiClient): Boolean {
            val changed = currentApi?.backendURL?.let { it != api.backendURL } ?: false
            currentApi = api
            return changed
        }
        override suspend fun page(page: Int): Result<List<MessageThread>> {
            pages += page
            return pageHandler(page)
        }
    }

    private class StoreOwner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private fun withScope(block: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            block(scope)
        } finally {
            scope.cancel()
        }
    }

    private fun session(cookie: String = "connect.sid=fictional-session") =
        session(cookie, "steady-heron")

    private fun session(cookie: String, username: String) =
        MemberSession(cookie, MobileMember(username, username.replace('-', ' ').replaceFirstChar(Char::uppercase)))

    private fun thread(id: String, name: String) = MessageThread(
        id = id,
        otherMember = MessageMember("member-$id", name.lowercase().replace(' ', '-'), name),
        excerpt = "A fictional conversation with $name.",
        read = false,
    )
}
