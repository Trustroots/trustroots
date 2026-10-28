package org.trustroots.android.ui.account

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

class AccountSettingsBranchContractsTest {
    @Test fun credentialRefreshIgnoresAnUpdateCheckThatCompletesFromTheOldSession() {
        val oldCheckResult = CompletableDeferred<ApkUpdateCheckResult>()
        val repository = ImmediateAccountRepository()
        val platform = BranchTestPlatform().apply {
            updateEnabled = true
            previewCheck = { withContext(NonCancellable) { oldCheckResult.await() } }
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val api = MobileApiClient("https://api.example.test")
        val oldSession = MemberSession("connect.sid=old", MobileMember("quiet-fox", "Quiet Fox"))
        val refreshedSession = MemberSession("connect.sid=new", MobileMember("quiet-fox", "Quiet Fox"))

        try {
            val viewModel = AccountSettingsViewModel("quiet-fox", repository, platform, scope, api, oldSession)
            viewModel.onEvent(AccountEvent.CheckPreviewUpdates)
            assertTrue(viewModel.state.value.isCheckingUpdates)

            viewModel.updateEnvironment(api, refreshedSession, platform)
            assertFalse(viewModel.state.value.isCheckingUpdates)
            assertTrue(viewModel.state.value.updateAlertsEnabled)

            oldCheckResult.complete(ApkUpdateCheckResult.UpToDate)

            assertFalse(viewModel.state.value.isCheckingUpdates)
            assertTrue("A result fetched with the prior cookie must not publish", viewModel.state.value.updateStatus == null)
            assertEquals(1, platform.previewChecks)
        } finally {
            scope.cancel()
        }
    }
}

private class ImmediateAccountRepository : AccountRepository {
    override suspend fun details() = Result.success(
        AccountDetails("quiet-fox", "Quiet Fox", "member@example.test", newsletter = false),
    )

    override suspend fun update(email: String, newsletter: Boolean) =
        Result.success(AccountDetails("quiet-fox", "Quiet Fox", email, newsletter = newsletter))

    override suspend fun changePassword(current: String, new: String, verify: String) = Result.success(Unit)

    override suspend fun signOut() = Result.success(Unit)
}

private class BranchTestPlatform : AccountPlatformSettings {
    override val messageAlertStatus = MutableStateFlow<MessageAlertStatusMetadata?>(null)
    var updateEnabled = false
    var previewChecks = 0
    var previewCheck: suspend () -> ApkUpdateCheckResult = { ApkUpdateCheckResult.Unavailable }

    override fun messageAlertsEnabled(username: String) = false
    override suspend fun disableMessageAlerts() = Unit
    override fun updateAlertsEnabled() = updateEnabled
    override fun setUpdateAlertsEnabled(enabled: Boolean) { updateEnabled = enabled }
    override suspend fun checkPreviewUpdates(): ApkUpdateCheckResult {
        previewChecks++
        return previewCheck()
    }
}
