package org.trustroots.android.ui

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberShellBranchContractsTest {
    @Test
    fun lifecycleStopDuringPollWaitPreventsAnotherRepositoryRequest() = withScope { scope ->
        val repository = BranchRepository()
        lateinit var model: MemberShellViewModel
        var waitCalls = 0
        model = MemberShellViewModel(repository, scope) {
            waitCalls += 1
            model.onEvent(MemberShellEvent.LifecycleChanged(false))
        }

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(8))

        assertEquals(1, repository.unreadCalls)
        assertEquals(1, waitCalls)
        assertEquals(6, model.state.value.unreadMessageCount)
        assertFalse(model.state.value.isUnreadRefreshing)

        model.onEvent(MemberShellEvent.LifecycleChanged(true))

        assertEquals("Resuming starts a new immediate poll", 2, repository.unreadCalls)
        assertEquals(6, model.state.value.unreadMessageCount)
    }

    @Test
    fun unreadRefreshCannotRestartPollingWhileSessionInvalidationIsPending() = withScope { scope ->
        val repository = BranchRepository().apply {
            unreadHandler = { Result.failure(MobileApiException(401, "Expired credentials")) }
        }
        val model = MemberShellViewModel(repository, scope) { CompletableDeferred<Unit>().await() }

        model.onEvent(MemberShellEvent.LifecycleChanged(true))
        model.onEvent(MemberShellEvent.ActiveVisitChanged(3))
        val invalidation = requireNotNull(model.state.value.pendingSessionInvalidation)

        model.onEvent(MemberShellEvent.RefreshUnread)

        assertEquals(1, repository.unreadCalls)
        assertEquals(invalidation, model.state.value.pendingSessionInvalidation)
        assertFalse(model.state.value.isUnreadRefreshing)
        model.onEvent(MemberShellEvent.InvalidationDelivered(invalidation.id))
        assertNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MemberShellEvent.RefreshUnread)
        assertEquals("Acknowledging invalidation alone does not revalidate the session", 1, repository.unreadCalls)
    }

    private fun withScope(test: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            test(scope)
        } finally {
            scope.cancel()
        }
    }

    private class BranchRepository : MemberShellRepository {
        var unreadCalls = 0
        var unreadHandler: suspend (Int) -> Result<Int> = { Result.success(6) }

        override fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean = false

        override suspend fun ownAvatarID(): Result<String?> = Result.success("member-safe-id")

        override suspend fun unreadCount(): Result<Int> = unreadHandler(++unreadCalls)
    }
}
