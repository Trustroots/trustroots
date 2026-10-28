package org.trustroots.android.ui.account

import androidx.lifecycle.ViewModelStore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.updates.ApkUpdateCheckResult

class AccountEntryCleanupBranchContractsTest {
    @Test fun cookieRefreshWithNoJobsRetainsDraftAndSkipsReload() {
        val scope = cleanupScope()
        val repository = CleanupBranchRepository()
        val platform = CleanupBranchPlatform()
        try {
            val model = AccountSettingsViewModel("quiet-fox", repository, platform, scope, api(), session("old"))

            model.onEvent(AccountEvent.EmailChanged("draft@example.test"))
            model.updateEnvironment(api(), session("new"), platform)

            assertEquals("draft@example.test", model.state.value.email)
            assertEquals("quiet-fox", model.state.value.details?.username)
            assertEquals(1, repository.detailCalls)
        } finally {
            scope.cancel()
        }
    }

    @Test fun clearingEntryStoreCancelsSuspendedMessageAlertCleanup() {
        val scope = cleanupScope()
        val store = ViewModelStore()
        val started = CompletableDeferred<Unit>()
        val cancelled = CompletableDeferred<Unit>()
        val platform = CleanupBranchPlatform().apply {
            alertsEnabled = true
            disableHandler = {
                try {
                    started.complete(Unit)
                    CompletableDeferred<Unit>().await()
                } finally {
                    cancelled.complete(Unit)
                }
            }
        }
        val model = AccountSettingsViewModel("quiet-fox", CleanupBranchRepository(), platform, scope)
        store.put("account", model)

        try {
            model.onEvent(AccountEvent.ToggleMessageAlerts(notificationPermissionGranted = true))
            assertTrue(started.isCompleted)

            store.clear()

            assertTrue(cancelled.isCompleted)
            assertEquals(AccountSettingsUiState(), model.state.value)
            assertFalse(model.state.value.messageAlertsEnabled)
        } finally {
            store.clear()
            scope.cancel()
        }
    }

    @Test fun clearingEntryStoreCancelsSuspendedAccountLoad() {
        val scope = cleanupScope()
        val store = ViewModelStore()
        val started = CompletableDeferred<Unit>()
        val cancelled = CompletableDeferred<Unit>()
        val repository = CleanupBranchRepository().apply {
            detailsHandler = {
                try {
                    started.complete(Unit)
                    CompletableDeferred<Result<AccountDetails>>().await()
                } finally {
                    cancelled.complete(Unit)
                }
            }
        }
        val model = AccountSettingsViewModel("quiet-fox", repository, CleanupBranchPlatform(), scope)
        store.put("account", model)

        try {
            assertTrue(started.isCompleted)
            assertTrue(model.state.value.isLoading)

            store.clear()

            assertTrue(cancelled.isCompleted)
            assertEquals(AccountSettingsUiState(), model.state.value)
        } finally {
            store.clear()
            scope.cancel()
        }
    }

    @Test fun cookieRefreshCancelsPasswordChangeAndIgnoresItsLateResult() {
        val scope = cleanupScope()
        val started = CompletableDeferred<Unit>()
        val passwordResult = CompletableDeferred<Result<Unit>>()
        val repository = CleanupBranchRepository().apply {
            passwordHandler = {
                started.complete(Unit)
                withContext(NonCancellable) { passwordResult.await() }
            }
        }
        val platform = CleanupBranchPlatform()
        val model = AccountSettingsViewModel("quiet-fox", repository, platform, scope, api(), session("old"))
        try {
            model.onEvent(AccountEvent.CurrentPasswordChanged("old-pass"))
            model.onEvent(AccountEvent.NewPasswordChanged("new-pass"))
            model.onEvent(AccountEvent.VerifyPasswordChanged("new-pass"))
            model.onEvent(AccountEvent.ChangePassword)
            assertTrue(started.isCompleted)
            assertTrue(model.state.value.isChangingPassword)

            model.updateEnvironment(api(), session("new"), platform)
            passwordResult.complete(Result.success(Unit))

            assertFalse(model.state.value.isChangingPassword)
            assertNull(model.state.value.notice)
            assertEquals("new-pass", model.state.value.newPassword)
        } finally {
            scope.cancel()
        }
    }
}

private class CleanupBranchRepository : AccountRepository {
    var detailCalls = 0
    var detailsHandler: suspend () -> Result<AccountDetails> = {
        Result.success(
            AccountDetails(
                username = "quiet-fox",
                displayName = "Quiet Fox",
                email = "member@example.test",
                newsletter = false,
            ),
        )
    }
    var passwordHandler: suspend () -> Result<Unit> = { Result.success(Unit) }

    override suspend fun details(): Result<AccountDetails> {
        detailCalls++
        return detailsHandler()
    }

    override suspend fun update(email: String, newsletter: Boolean) =
        Result.success(
            AccountDetails(
                username = "quiet-fox",
                displayName = "Quiet Fox",
                email = email,
                newsletter = newsletter,
            ),
        )

    override suspend fun changePassword(current: String, new: String, verify: String) = passwordHandler()
    override suspend fun signOut() = Result.success(Unit)
}

private class CleanupBranchPlatform : AccountPlatformSettings {
    override val messageAlertStatus = MutableStateFlow<MessageAlertStatusMetadata?>(null)
    var alertsEnabled = false
    var disableHandler: suspend () -> Unit = {}

    override fun messageAlertsEnabled(username: String) = alertsEnabled
    override suspend fun disableMessageAlerts() {
        disableHandler()
        alertsEnabled = false
    }
    override fun updateAlertsEnabled() = false
    override fun setUpdateAlertsEnabled(enabled: Boolean) = Unit
    override suspend fun checkPreviewUpdates() = ApkUpdateCheckResult.Unavailable
}

private fun cleanupScope() = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
private fun api() = MobileApiClient("https://api.example.test")
private fun session(cookie: String) = MemberSession("connect.sid=$cookie", MobileMember("quiet-fox", "Quiet Fox"))
