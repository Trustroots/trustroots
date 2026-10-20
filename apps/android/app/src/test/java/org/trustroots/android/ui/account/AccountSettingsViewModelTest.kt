package org.trustroots.android.ui.account

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.R
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.updates.ApkUpdateCheckResult

class AccountSettingsViewModelTest {
    @Test fun loadsOnceSavesEmailAndKeepsSafeStateInTheEntryModel() {
        val repository = FakeRepository()
        val viewModel = model(repository)
        assertEquals(1, repository.detailCalls)
        assertEquals("member@example.test", viewModel.state.value.email)

        viewModel.onEvent(AccountEvent.EmailChanged("new@example.test"))
        assertTrue(viewModel.state.value.isDirty)
        viewModel.onEvent(AccountEvent.SaveAccount)

        assertEquals(1, repository.updateCalls)
        assertEquals("new@example.test", repository.updatedEmail)
        assertEquals(AccountNotice.AccountSaved, viewModel.state.value.notice)
        assertFalse(viewModel.state.value.isSavingAccount)
    }

    @Test fun passwordSuccessClearsEverySecretField() {
        val repository = FakeRepository()
        val viewModel = model(repository)
        viewModel.onEvent(AccountEvent.CurrentPasswordChanged("fictional-current"))
        viewModel.onEvent(AccountEvent.NewPasswordChanged("fictional-new"))
        viewModel.onEvent(AccountEvent.VerifyPasswordChanged("fictional-new"))
        assertTrue(viewModel.state.value.isDirty)
        viewModel.onEvent(AccountEvent.ChangePassword)

        assertEquals(1, repository.passwordCalls)
        assertEquals("fictional-current", repository.passwordCurrent)
        assertEquals("fictional-new", repository.passwordNew)
        assertEquals("fictional-new", repository.passwordVerify)
        assertEquals("", viewModel.state.value.currentPassword)
        assertEquals("", viewModel.state.value.newPassword)
        assertEquals("", viewModel.state.value.verifyPassword)
        assertEquals(AccountNotice.PasswordChanged, viewModel.state.value.notice)
    }

    @Test fun permissionAndActivityEffectsAreTypedAndAcknowledgedOnce() {
        val platform = FakePlatform()
        val viewModel = model(platform = platform)
        viewModel.onEvent(AccountEvent.ToggleMessageAlerts(notificationPermissionGranted = false))
        val permission = viewModel.state.value.pendingEffect as AccountEffect.RequestNotificationPermission
        assertEquals(AccountPermissionTarget.MESSAGE_ALERTS, permission.target)
        viewModel.onEvent(AccountEvent.EffectDelivered(permission.id))
        viewModel.onEvent(AccountEvent.NotificationPermissionResult(AccountPermissionTarget.MESSAGE_ALERTS, granted = true))
        val enable = viewModel.state.value.pendingEffect as AccountEffect.EnableMessageAlerts
        viewModel.onEvent(AccountEvent.EffectDelivered(enable.id))
        platform.enabled = true
        viewModel.onEvent(AccountEvent.MessageAlertsEnabled(MessageAlertStatusMetadata(R.string.message_alerts_ready)))
        assertEquals(MessageAlertStatusMetadata(R.string.message_alerts_ready), viewModel.state.value.messageAlertStatus)
        assertTrue(viewModel.state.value.messageAlertsEnabled)
        assertEquals(null, viewModel.state.value.pendingEffect)
    }

    @Test fun authenticationFailureEmitsOneInvalidationAndBlocksFurtherLoads() {
        val repository = FakeRepository().apply {
            detailsResult = Result.failure(MobileApiException(statusCode = 401))
        }
        val viewModel = model(repository)
        val effect = viewModel.state.value.pendingEffect as AccountEffect.SessionInvalidated
        viewModel.onEvent(AccountEvent.EffectDelivered(effect.id))
        viewModel.onEvent(AccountEvent.RetryLoad)
        assertEquals(1, repository.detailCalls)
        assertEquals(null, viewModel.state.value.pendingEffect)
    }

    @Test fun sameAccountCredentialRefreshCancelsStaleSaveAndKeepsDraftForExplicitRetry() {
        val staleSave = CompletableDeferred<Result<AccountDetails>>()
        val repository = FakeRepository().apply {
            updateHandler = { call, email, newsletter ->
                if (call == 1) withContext(NonCancellable) { staleSave.await() }
                else Result.success(AccountDetails("quiet-fox", "Quiet Fox", email, newsletter = newsletter))
            }
        }
        val api = MobileApiClient("https://api.example.test")
        val originalSession = MemberSession("connect.sid=old", MobileMember("quiet-fox", "Quiet Fox"))
        val refreshedSession = MemberSession("connect.sid=new", MobileMember("quiet-fox", "Quiet Fox"))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val viewModel = AccountSettingsViewModel(
                "quiet-fox", repository, FakePlatform(), scope, api, originalSession,
            )
            viewModel.onEvent(AccountEvent.EmailChanged("draft@example.test"))
            viewModel.onEvent(AccountEvent.CurrentPasswordChanged("fictional-current"))
            viewModel.onEvent(AccountEvent.SaveAccount)
            assertTrue(viewModel.state.value.isSavingAccount)
            assertEquals(1, repository.updateCalls)

            viewModel.updateEnvironment(api, refreshedSession, FakePlatform())
            assertFalse(viewModel.state.value.isSavingAccount)
            assertEquals("draft@example.test", viewModel.state.value.email)
            assertEquals("fictional-current", viewModel.state.value.currentPassword)
            assertEquals("A credential refresh must not replay a save", 1, repository.updateCalls)

            staleSave.complete(Result.success(AccountDetails("quiet-fox", "Quiet Fox", "obsolete@example.test", newsletter = false)))
            assertEquals("draft@example.test", viewModel.state.value.email)
            assertEquals(1, repository.updateCalls)

            viewModel.onEvent(AccountEvent.SaveAccount)
            assertEquals(2, repository.updateCalls)
            assertEquals(listOf("connect.sid=old", "connect.sid=new"), repository.updateCookies)
            assertEquals("draft@example.test", viewModel.state.value.details?.email)
        } finally {
            scope.cancel()
        }
    }

    @Test fun refreshedCredentialsClearInvalidationAndWaitForExplicitLoadRetry() {
        val repository = FakeRepository().apply {
            detailsHandler = { call ->
                if (call == 1) Result.failure(MobileApiException(statusCode = 401))
                else Result.success(AccountDetails("quiet-fox", "Quiet Fox", "fresh@example.test", newsletter = false))
            }
        }
        val api = MobileApiClient("https://api.example.test")
        val originalSession = MemberSession("connect.sid=old", MobileMember("quiet-fox", "Quiet Fox"))
        val refreshedSession = MemberSession("connect.sid=new", MobileMember("quiet-fox", "Quiet Fox"))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val viewModel = AccountSettingsViewModel(
                "quiet-fox", repository, FakePlatform(), scope, api, originalSession,
            )
            assertTrue(viewModel.state.value.pendingEffect is AccountEffect.SessionInvalidated)
            viewModel.updateEnvironment(api, refreshedSession, FakePlatform())
            assertEquals(null, viewModel.state.value.pendingEffect)
            assertEquals(1, repository.detailCalls)
            assertTrue(viewModel.state.value.failure != null)

            viewModel.onEvent(AccountEvent.RetryLoad)
            assertEquals(2, repository.detailCalls)
            assertEquals("connect.sid=new", repository.currentCookie)
            assertEquals("fresh@example.test", viewModel.state.value.details?.email)
        } finally {
            scope.cancel()
        }
    }

    @Test fun switchingAccountClearsPrivateFieldsAndReloadsForNewMember() {
        val repository = FakeRepository().apply {
            detailsHandler = { call ->
                if (call == 1) Result.success(AccountDetails("quiet-fox", "Quiet Fox", "old@example.test", newsletter = false))
                else Result.success(AccountDetails("calm-lynx", "Calm Lynx", "new@example.test", newsletter = true))
            }
        }
        val api = MobileApiClient("https://api.example.test")
        val oldSession = MemberSession("connect.sid=old", MobileMember("quiet-fox", "Quiet Fox"))
        val newSession = MemberSession("connect.sid=new", MobileMember("calm-lynx", "Calm Lynx"))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val viewModel = AccountSettingsViewModel(
                "quiet-fox", repository, FakePlatform(), scope, initialApi = api, initialSession = oldSession,
            )
            viewModel.onEvent(AccountEvent.EmailChanged("private-draft@example.test"))
            viewModel.onEvent(AccountEvent.CurrentPasswordChanged("fictional-secret"))

            viewModel.updateEnvironment(api, newSession, FakePlatform())

            assertEquals(2, repository.detailCalls)
            assertEquals("new@example.test", viewModel.state.value.email)
            assertEquals("calm-lynx", viewModel.state.value.details?.username)
            assertEquals("", viewModel.state.value.currentPassword)
            assertFalse(viewModel.state.value.isDirty)
        } finally {
            scope.cancel()
        }
    }

    @Test fun signOutDisablesAlertsBeforeCallingTheExistingAPIAndEmitsOneEffect() {
        val operations = mutableListOf<String>()
        val repository = FakeRepository(operations)
        val platform = FakePlatform(operations)
        val viewModel = model(repository, platform)
        viewModel.onEvent(AccountEvent.SignOut)
        viewModel.onEvent(AccountEvent.SignOut)
        assertEquals(listOf("load", "disable-alerts", "sign-out"), operations)
        assertTrue(viewModel.state.value.pendingEffect is AccountEffect.SignedOut)
    }

    @Test fun signOutStillCompletesWhenPushCleanupAndServerRequestFail() {
        val operations = mutableListOf<String>()
        val repository = FakeRepository(operations).apply { signOutResult = Result.failure(IllegalStateException("offline")) }
        val platform = FakePlatform(operations).apply { disableFailure = IllegalStateException("distributor unavailable") }
        val viewModel = model(repository, platform)

        viewModel.onEvent(AccountEvent.SignOut)

        assertEquals(listOf("load", "disable-alerts", "sign-out"), operations)
        assertTrue(viewModel.state.value.pendingEffect is AccountEffect.SignedOut)
    }

    @Test fun credentialRefreshClearsUndeliveredSignedOutEffectAndKeepsSameAccountDraft() {
        val repository = FakeRepository()
        val api = MobileApiClient("https://api.example.test")
        val oldSession = MemberSession("connect.sid=old", MobileMember("quiet-fox", "Quiet Fox"))
        val refreshedSession = MemberSession("connect.sid=new", MobileMember("quiet-fox", "Quiet Fox"))
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val viewModel = AccountSettingsViewModel(
                "quiet-fox", repository, FakePlatform(), scope, api, oldSession,
            )
            viewModel.onEvent(AccountEvent.EmailChanged("draft@example.test"))
            viewModel.onEvent(AccountEvent.SignOut)
            assertTrue(viewModel.state.value.pendingEffect is AccountEffect.SignedOut)

            viewModel.updateEnvironment(api, refreshedSession, FakePlatform())

            assertEquals(null, viewModel.state.value.pendingEffect)
            assertEquals("draft@example.test", viewModel.state.value.email)
            assertTrue(viewModel.state.value.isDirty)
            assertEquals(1, repository.signOutCalls)
        } finally {
            scope.cancel()
        }
    }

    private fun model(
        repository: FakeRepository = FakeRepository(),
        platform: FakePlatform = FakePlatform(),
    ) = AccountSettingsViewModel(
        username = "quiet-fox",
        repository = repository,
        platform = platform,
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined),
        initialApi = MobileApiClient("https://api.example.test"),
        initialSession = MemberSession("connect.sid=fixture", MobileMember("quiet-fox", "Quiet Fox")),
    )

    private class FakeRepository(private val operations: MutableList<String>? = null) : AccountRepository {
        var detailCalls = 0
        var updateCalls = 0
        var passwordCalls = 0
        var signOutCalls = 0
        val updateCookies = mutableListOf<String?>()
        var currentCookie: String? = null
        var updatedEmail: String? = null
        var passwordCurrent: String? = null
        var passwordNew: String? = null
        var passwordVerify: String? = null
        var signOutResult = Result.success(Unit)
        var detailsResult = Result.success(AccountDetails("quiet-fox", "Quiet Fox", "member@example.test", newsletter = false))
        var detailsHandler: (suspend (Int) -> Result<AccountDetails>)? = null
        var updateHandler: (suspend (Int, String, Boolean) -> Result<AccountDetails>)? = null

        override fun updateSession(session: MemberSession): Boolean {
            val changed = currentCookie != session.cookieHeader
            currentCookie = session.cookieHeader
            return changed
        }

        override suspend fun details(): Result<AccountDetails> {
            detailCalls++
            operations?.add("load")
            return detailsHandler?.invoke(detailCalls) ?: detailsResult
        }

        override suspend fun update(email: String, newsletter: Boolean): Result<AccountDetails> {
            updateCalls++
            updatedEmail = email
            updateCookies += currentCookie
            updateHandler?.let { return it(updateCalls, email, newsletter) }
            return Result.success(AccountDetails("quiet-fox", "Quiet Fox", email, newsletter = newsletter))
        }

        override suspend fun changePassword(current: String, new: String, verify: String): Result<Unit> {
            passwordCalls++
            passwordCurrent = current
            passwordNew = new
            passwordVerify = verify
            return Result.success(Unit)
        }

        override suspend fun signOut(): Result<Unit> {
            signOutCalls++
            operations?.add("sign-out")
            return signOutResult
        }
    }

    private class FakePlatform(private val operations: MutableList<String>? = null) : AccountPlatformSettings {
        override val messageAlertStatus = MutableStateFlow<MessageAlertStatusMetadata?>(null)
        var enabled = false
        var disableFailure: Throwable? = null

        override fun messageAlertsEnabled(username: String) = enabled
        override suspend fun disableMessageAlerts() {
            operations?.add("disable-alerts")
            disableFailure?.let { throw it }
            enabled = false
        }
        override fun updateAlertsEnabled() = false
        override fun setUpdateAlertsEnabled(enabled: Boolean) = Unit
        override suspend fun checkPreviewUpdates() = ApkUpdateCheckResult.Unavailable
    }
}
