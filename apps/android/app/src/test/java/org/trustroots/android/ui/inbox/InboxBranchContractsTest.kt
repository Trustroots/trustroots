package org.trustroots.android.ui.inbox

import androidx.lifecycle.ViewModel
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
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class InboxBranchContractsTest {
    @Test
    fun factoryRejectsAnUnrelatedViewModelType() {
        val factory = InboxViewModel.Factory(
            repository = object : InboxRepository {
                override suspend fun page(page: Int): Result<List<MessageThread>> = Result.success(emptyList())
            },
            session = session(),
        )

        val error = runCatching { factory.create(UnrelatedViewModel::class.java) }.exceptionOrNull()

        assertTrue(error is IllegalArgumentException)
    }

    private class UnrelatedViewModel : ViewModel()

    @Test
    fun lateFailureFromReplacedSessionDoesNotReplaceCurrentInboxState() = withScope { scope ->
        val oldResponse = CompletableDeferred<Result<List<MessageThread>>>()
        var calls = 0
        val repository = object : InboxRepository {
            override fun updateSession(session: MemberSession) = true

            override suspend fun page(page: Int): Result<List<MessageThread>> {
                calls++
                return if (calls == 1) {
                    withContext(NonCancellable) { oldResponse.await() }
                } else {
                    Result.success(listOf(thread("current-thread")))
                }
            }
        }
        val model = InboxViewModel(repository, session(), scope)

        model.onEvent(InboxEvent.SessionChanged(session("renewed-session", "calm-lynx")))
        oldResponse.complete(Result.failure(MobileApiException(503, serverMessage = "A fictional stale failure.")))

        assertEquals(2, calls)
        assertEquals(listOf("current-thread"), model.state.value.threads.map(MessageThread::id))
        assertTrue(model.state.value.hasLoaded)
        assertFalse(model.state.value.isLoading)
        assertNull(model.state.value.failure)
        assertNull(model.state.value.pendingSessionInvalidation)
    }

    private fun withScope(block: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            block(scope)
        } finally {
            scope.cancel()
        }
    }

    private fun session(cookie: String = "connect.sid=fictional-session", username: String = "steady-heron") =
        MemberSession(cookie, MobileMember(username, "Fictional Member"))

    private fun thread(id: String) = MessageThread(
        id = id,
        otherMember = MessageMember("member-$id", "quiet-fox", "Quiet Fox"),
        excerpt = "A fictional conversation.",
        read = false,
    )
}
