package org.trustroots.android.ui.account

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.updates.ApkUpdateCheckResult

internal interface AccountRepository {
    fun updateApi(api: MobileApiClient): Boolean = false
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun details(): Result<AccountDetails>
    suspend fun update(email: String, newsletter: Boolean): Result<AccountDetails>
    suspend fun changePassword(current: String, new: String, verify: String): Result<Unit>
    suspend fun signOut(): Result<Unit>
}

internal class MobileApiAccountRepository(
    api: MobileApiClient,
    session: MemberSession,
) : AccountRepository {
    private var api = api
    private var session = session

    override fun updateApi(api: MobileApiClient): Boolean {
        val changedBackend = this.api.backendURL != api.backendURL
        this.api = api
        return changedBackend
    }

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override suspend fun details() = api.accountDetails(session)
    override suspend fun update(email: String, newsletter: Boolean) = api.updateAccount(session, email, newsletter)
    override suspend fun changePassword(current: String, new: String, verify: String) =
        api.changePassword(session, current, new, verify)
    override suspend fun signOut() = api.signOut(session)
}

/** Platform operations that can use an application context, never an Activity. */
internal interface AccountPlatformSettings {
    val messageAlertStatus: StateFlow<MessageAlertStatusMetadata?>
    fun updateSession(session: MemberSession) = Unit
    fun messageAlertsEnabled(username: String): Boolean
    suspend fun disableMessageAlerts()
    fun updateAlertsEnabled(): Boolean
    fun setUpdateAlertsEnabled(enabled: Boolean)
    suspend fun checkPreviewUpdates(): ApkUpdateCheckResult
}

internal class AndroidAccountPlatformSettings(
    context: Context,
    session: MemberSession,
    private val previewAlertsEnabled: Boolean,
    private val isUpdateAlertsEnabled: (Context) -> Boolean = ApkUpdateAlerts::isEnabled,
    private val setUpdateAlertsEnabled: (Context, Boolean) -> Unit = ApkUpdateAlerts::setEnabled,
    private val checkPreviewUpdates: suspend (Context) -> ApkUpdateCheckResult = ApkUpdateAlerts::checkNow,
    private val disableMessageAlerts: suspend (Context, MemberSession) -> Unit = MessageAlerts::disable,
) : AccountPlatformSettings {
    private val appContext = context.applicationContext
    private var session = session
    override val messageAlertStatus = MessageAlerts.statusMetadata

    override fun updateSession(session: MemberSession) {
        this.session = session
    }

    override fun messageAlertsEnabled(username: String) = MessageAlerts.isEnabled(appContext, username)

    override suspend fun disableMessageAlerts() = disableMessageAlerts(appContext, session)

    override fun updateAlertsEnabled() = previewAlertsEnabled && isUpdateAlertsEnabled(appContext)

    override fun setUpdateAlertsEnabled(enabled: Boolean) = setUpdateAlertsEnabled(appContext, enabled)

    override suspend fun checkPreviewUpdates() = checkPreviewUpdates(appContext)
}

internal sealed interface AccountNotice {
    data object AccountSaved : AccountNotice
    data object PasswordChanged : AccountNotice
}

internal sealed interface AccountUpdateStatus {
    data object AlertsOff : AccountUpdateStatus
    data object PermissionDenied : AccountUpdateStatus
    data object Latest : AccountUpdateStatus
    data object Unavailable : AccountUpdateStatus
    data class NewVersion(val versionName: String, val pageUrl: String) : AccountUpdateStatus
}

internal enum class AccountPermissionTarget { MESSAGE_ALERTS, PREVIEW_UPDATES }

internal sealed interface AccountEffect {
    val id: Long

    data class RequestNotificationPermission(override val id: Long, val target: AccountPermissionTarget) : AccountEffect
    data class EnableMessageAlerts(override val id: Long) : AccountEffect
    data class OpenRelease(override val id: Long, val url: String) : AccountEffect
    data class OpenResetPassword(override val id: Long) : AccountEffect
    data class SignedOut(override val id: Long) : AccountEffect
    data class SessionInvalidated(override val id: Long) : AccountEffect
}

internal data class AccountSettingsUiState(
    val details: AccountDetails? = null,
    val email: String = "",
    val newsletter: Boolean = false,
    val currentPassword: String = "",
    val newPassword: String = "",
    val verifyPassword: String = "",
    val isLoading: Boolean = false,
    val isSavingAccount: Boolean = false,
    val isChangingPassword: Boolean = false,
    val isSigningOut: Boolean = false,
    val notice: AccountNotice? = null,
    val failure: UiFailure? = null,
    val messageAlertsEnabled: Boolean = false,
    val messageAlertStatus: MessageAlertStatusMetadata? = null,
    val updateAlertsEnabled: Boolean = false,
    val isCheckingUpdates: Boolean = false,
    val updateStatus: AccountUpdateStatus? = null,
    val pendingEffect: AccountEffect? = null,
) {
    val isDirty: Boolean get() = details?.let { email != it.email || newsletter != it.newsletter } == true ||
        currentPassword.isNotEmpty() || newPassword.isNotEmpty() || verifyPassword.isNotEmpty()
    val isBusy: Boolean get() = isSavingAccount || isChangingPassword || isSigningOut
}

internal sealed interface AccountEvent {
    data class EmailChanged(val value: String) : AccountEvent
    data class NewsletterChanged(val value: Boolean) : AccountEvent
    data class CurrentPasswordChanged(val value: String) : AccountEvent
    data class NewPasswordChanged(val value: String) : AccountEvent
    data class VerifyPasswordChanged(val value: String) : AccountEvent
    data object RetryLoad : AccountEvent
    data object SaveAccount : AccountEvent
    data object ChangePassword : AccountEvent
    data class ToggleMessageAlerts(val notificationPermissionGranted: Boolean) : AccountEvent
    data class NotificationPermissionResult(val target: AccountPermissionTarget, val granted: Boolean) : AccountEvent
    data class MessageAlertsEnabled(val result: MessageAlertStatusMetadata) : AccountEvent
    data class ToggleUpdateAlerts(val notificationPermissionGranted: Boolean) : AccountEvent
    data object CheckPreviewUpdates : AccountEvent
    data object OpenRelease : AccountEvent
    data object ResetPassword : AccountEvent
    data object SignOut : AccountEvent
    data class EffectDelivered(val id: Long) : AccountEvent
}

internal class AccountSettingsViewModel(
    username: String,
    private val repository: AccountRepository,
    platform: AccountPlatformSettings,
    scope: CoroutineScope? = null,
    initialApi: MobileApiClient? = null,
    initialSession: MemberSession? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private var username = username
    private var platform = platform
    private var backendURL: String? = initialApi?.backendURL
    private var cookieHeader: String? = initialSession?.cookieHeader
    private val mutableState = MutableStateFlow(
        AccountSettingsUiState(
            messageAlertsEnabled = platform.messageAlertsEnabled(username),
            messageAlertStatus = platform.messageAlertStatus.value,
            updateAlertsEnabled = platform.updateAlertsEnabled(),
        ),
    )
    val state = mutableState.asStateFlow()
    private var nextEffectID = 0L
    private var platformJob: Job? = null
    private val accountRequest = LatestRequest(requestScope)
    private val passwordRequest = LatestRequest(requestScope)
    private val updateRequest = LatestRequest(requestScope)
    private val platformActionRequest = LatestRequest(requestScope)
    private val signOutRequest = LatestRequest(requestScope)
    private var sessionInvalidated = false

    init {
        initialApi?.let(repository::updateApi)
        initialSession?.let(repository::updateSession)
        initialSession?.let(platform::updateSession)
        observeMessageAlertStatus()
        load()
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession, platform: AccountPlatformSettings) {
        val backendChanged = backendURL != api.backendURL
        val accountChanged = username != session.member.username
        val credentialsChanged = cookieHeader != session.cookieHeader
        val environmentChanged = backendChanged || accountChanged || credentialsChanged
        if (environmentChanged) cancelEnvironmentJobs()
        repository.updateApi(api)
        repository.updateSession(session)
        platform.updateSession(session)
        val platformChanged = this.platform !== platform
        if (platformChanged) {
            this.platform = platform
            observeMessageAlertStatus()
        }
        if (!environmentChanged) {
            if (platformChanged) refreshPlatformState(session.member.username)
            return
        }

        backendURL = api.backendURL
        username = session.member.username
        cookieHeader = session.cookieHeader
        sessionInvalidated = false

        if (backendChanged || accountChanged) {
            load(
                resetState = AccountSettingsUiState(
                    messageAlertsEnabled = platform.messageAlertsEnabled(username),
                    messageAlertStatus = platform.messageAlertStatus.value,
                    updateAlertsEnabled = platform.updateAlertsEnabled(),
                ),
                refreshPlatformSettings = platformChanged,
            )
        } else {
            if (platformChanged) refreshPlatformState(username)
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    isSavingAccount = false,
                    isChangingPassword = false,
                    isSigningOut = false,
                    isCheckingUpdates = false,
                    failure = if (current.details == null) {
                        UiFailure(fallback = UiFailureFallback.ACCOUNT_LOAD)
                    } else {
                        null
                    },
                    // Effects belong to the credentials that produced them. A
                    // refreshed session must not deliver a stale sign-out or
                    // platform action through the new session's callbacks.
                    pendingEffect = null,
                )
            }
        }
    }

    private fun refreshPlatformState(username: String) {
        mutableState.update {
            it.copy(
                messageAlertsEnabled = platform.messageAlertsEnabled(username),
                messageAlertStatus = platform.messageAlertStatus.value,
                updateAlertsEnabled = platform.updateAlertsEnabled(),
            )
        }
    }

    private fun observeMessageAlertStatus() {
        platformJob?.cancel()
        platformJob = requestScope.launch {
            platform.messageAlertStatus.collect { status ->
                mutableState.update { it.copy(messageAlertStatus = status) }
            }
        }
    }

    private fun cancelEnvironmentJobs() {
        accountRequest.cancel()
        passwordRequest.cancel()
        updateRequest.cancel()
        signOutRequest.cancel()
        platformActionRequest.cancel()
    }

    fun onEvent(event: AccountEvent) {
        when (event) {
            is AccountEvent.EmailChanged -> mutableState.update { it.copy(email = event.value) }
            is AccountEvent.NewsletterChanged -> mutableState.update { it.copy(newsletter = event.value) }
            is AccountEvent.CurrentPasswordChanged -> mutableState.update { it.copy(currentPassword = event.value) }
            is AccountEvent.NewPasswordChanged -> mutableState.update { it.copy(newPassword = event.value) }
            is AccountEvent.VerifyPasswordChanged -> mutableState.update { it.copy(verifyPassword = event.value) }
            AccountEvent.RetryLoad -> load(force = true)
            AccountEvent.SaveAccount -> saveAccount()
            AccountEvent.ChangePassword -> changePassword()
            is AccountEvent.ToggleMessageAlerts -> toggleMessageAlerts(event.notificationPermissionGranted)
            is AccountEvent.NotificationPermissionResult -> notificationPermissionResult(event)
            is AccountEvent.MessageAlertsEnabled -> {
                val isEnabled = platform.messageAlertsEnabled(username)
                mutableState.update { it.copy(messageAlertStatus = event.result, messageAlertsEnabled = isEnabled) }
            }
            is AccountEvent.ToggleUpdateAlerts -> toggleUpdateAlerts(event.notificationPermissionGranted)
            AccountEvent.CheckPreviewUpdates -> checkUpdates()
            AccountEvent.OpenRelease -> (mutableState.value.updateStatus as? AccountUpdateStatus.NewVersion)?.let { release ->
                emitEffect { id -> AccountEffect.OpenRelease(id, release.pageUrl) }
            }
            AccountEvent.ResetPassword -> emitEffect { AccountEffect.OpenResetPassword(it) }
            AccountEvent.SignOut -> signOut()
            is AccountEvent.EffectDelivered -> mutableState.update {
                if (it.pendingEffect?.id == event.id) it.copy(pendingEffect = null) else it
            }
        }
    }

    private fun load(
        force: Boolean = false,
        resetState: AccountSettingsUiState? = null,
        refreshPlatformSettings: Boolean = false,
    ) {
        val current = mutableState.value
        if (sessionInvalidated || (resetState == null && (current.isLoading || (current.details != null && !force)))) return
        accountRequest.launch {
            if (refreshPlatformSettings) {
                refreshPlatformState(username)
                currentCoroutineContext().ensureActive()
            }
            if (resetState != null) {
                mutableState.value = resetState
                currentCoroutineContext().ensureActive()
            }
            mutableState.update { it.copy(isLoading = true, failure = null) }
            requestResult { repository.details() }.fold(
                onSuccess = { details ->
                    mutableState.update {
                        it.copy(details = details, email = details.email, newsletter = details.newsletter, isLoading = false)
                    }
                },
                onFailure = { error ->
                    mutableState.update { it.copy(isLoading = false) }
                    currentCoroutineContext().ensureActive()
                    finishFailure(error, UiFailureFallback.ACCOUNT_LOAD)
                },
            )
        }
    }

    private fun saveAccount() {
        val current = mutableState.value
        if (sessionInvalidated || current.isSavingAccount || current.email.isBlank()) return
        accountRequest.launch {
            mutableState.update { it.copy(isSavingAccount = true, failure = null, notice = null) }
            requestResult { repository.update(current.email, current.newsletter) }.fold(
                onSuccess = { details ->
                    mutableState.update { it.copy(details = details, isSavingAccount = false, notice = AccountNotice.AccountSaved) }
                },
                onFailure = { error ->
                    mutableState.update { it.copy(isSavingAccount = false) }
                    currentCoroutineContext().ensureActive()
                    finishFailure(error, UiFailureFallback.ACCOUNT_SAVE)
                },
            )
        }
    }

    private fun changePassword() {
        val current = mutableState.value
        if (sessionInvalidated || current.isChangingPassword || current.currentPassword.isBlank() ||
            current.newPassword.isBlank() || current.newPassword != current.verifyPassword
        ) return
        passwordRequest.launch {
            mutableState.update { it.copy(isChangingPassword = true, failure = null, notice = null) }
            requestResult { repository.changePassword(current.currentPassword, current.newPassword, current.verifyPassword) }.fold(
                onSuccess = {
                    mutableState.update {
                        it.copy(
                            isChangingPassword = false,
                            currentPassword = "",
                            newPassword = "",
                            verifyPassword = "",
                            notice = AccountNotice.PasswordChanged,
                        )
                    }
                },
                onFailure = { error ->
                    mutableState.update { it.copy(isChangingPassword = false) }
                    currentCoroutineContext().ensureActive()
                    finishFailure(error, UiFailureFallback.PASSWORD_CHANGE)
                },
            )
        }
    }

    private fun toggleMessageAlerts(notificationPermissionGranted: Boolean) {
        val current = mutableState.value
        if (current.messageAlertsEnabled) {
            platformActionRequest.launch {
                platform.disableMessageAlerts()
                currentCoroutineContext().ensureActive()
                mutableState.update {
                    it.copy(
                        messageAlertsEnabled = false,
                        messageAlertStatus = MessageAlertStatusMetadata(org.trustroots.android.R.string.screen_message_alerts_off),
                    )
                }
            }
        } else if (!notificationPermissionGranted) {
            emitEffect { AccountEffect.RequestNotificationPermission(it, AccountPermissionTarget.MESSAGE_ALERTS) }
        } else {
            emitEffect { AccountEffect.EnableMessageAlerts(it) }
        }
    }

    private fun toggleUpdateAlerts(notificationPermissionGranted: Boolean) {
        if (mutableState.value.updateAlertsEnabled) {
            updateRequest.cancel()
            platform.setUpdateAlertsEnabled(false)
            mutableState.update {
                it.copy(updateAlertsEnabled = false, isCheckingUpdates = false, updateStatus = AccountUpdateStatus.AlertsOff)
            }
        } else if (!notificationPermissionGranted) {
            emitEffect { AccountEffect.RequestNotificationPermission(it, AccountPermissionTarget.PREVIEW_UPDATES) }
        } else {
            platform.setUpdateAlertsEnabled(true)
            checkUpdates(enableAlerts = true)
        }
    }

    private fun notificationPermissionResult(event: AccountEvent.NotificationPermissionResult) {
        if (!event.granted) {
            when (event.target) {
                AccountPermissionTarget.MESSAGE_ALERTS -> mutableState.update {
                    it.copy(messageAlertStatus = MessageAlertStatusMetadata(org.trustroots.android.R.string.screen_allow_message_notifications))
                }
                AccountPermissionTarget.PREVIEW_UPDATES -> mutableState.update { it.copy(updateStatus = AccountUpdateStatus.PermissionDenied) }
            }
            return
        }
        when (event.target) {
            AccountPermissionTarget.MESSAGE_ALERTS -> emitEffect { AccountEffect.EnableMessageAlerts(it) }
            AccountPermissionTarget.PREVIEW_UPDATES -> {
                platform.setUpdateAlertsEnabled(true)
                checkUpdates(enableAlerts = true)
            }
        }
    }

    private fun checkUpdates(enableAlerts: Boolean = false) {
        if (!enableAlerts && !mutableState.value.updateAlertsEnabled) return
        updateRequest.launch {
            if (enableAlerts) {
                mutableState.update { it.copy(updateAlertsEnabled = true, updateStatus = null) }
                currentCoroutineContext().ensureActive()
            }
            mutableState.update { it.copy(isCheckingUpdates = true, updateStatus = null) }
            currentCoroutineContext().ensureActive()
            val result = try { platform.checkPreviewUpdates() } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Throwable) { ApkUpdateCheckResult.Unavailable }
            currentCoroutineContext().ensureActive()
            val status = when (result) {
                ApkUpdateCheckResult.UpToDate -> AccountUpdateStatus.Latest
                ApkUpdateCheckResult.Unavailable -> AccountUpdateStatus.Unavailable
                is ApkUpdateCheckResult.NewVersion -> AccountUpdateStatus.NewVersion(result.release.versionName, result.release.pageUrl)
            }
            mutableState.update { it.copy(isCheckingUpdates = false, updateStatus = status) }
        }
    }

    private fun signOut() {
        if (mutableState.value.isSigningOut) return
        accountRequest.cancel()
        passwordRequest.cancel()
        updateRequest.cancel()
        signOutRequest.launch {
            mutableState.update { it.copy(isSigningOut = true, currentPassword = "", newPassword = "", verifyPassword = "", failure = null) }
            currentCoroutineContext().ensureActive()
            // Clearing local push credentials is best-effort: a distributor or
            // network failure must not strand the user in a signed-in session.
            try {
                platform.disableMessageAlerts()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                // Continue with the existing server sign-out operation.
            }
            currentCoroutineContext().ensureActive()
            try {
                repository.signOut()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                // The UI historically completed local sign-out even when this
                // best-effort request failed.
            }
            currentCoroutineContext().ensureActive()
            emitEffect { AccountEffect.SignedOut(it) }
        }
    }

    private fun finishFailure(error: Throwable, fallback: UiFailureFallback) {
        if (error.isAuthenticationFailure()) {
            if (!sessionInvalidated) {
                sessionInvalidated = true
                emitEffect { AccountEffect.SessionInvalidated(it) }
            }
        } else mutableState.update { it.copy(failure = error.toUiFailure(fallback)) }
    }

    private fun emitEffect(create: (Long) -> AccountEffect) {
        val effect = create(++nextEffectID)
        mutableState.update { current ->
            if (current.pendingEffect == null || effect is AccountEffect.SessionInvalidated || effect is AccountEffect.SignedOut) {
                current.copy(pendingEffect = effect)
            } else current
        }
    }


    override fun onCleared() {
        accountRequest.cancel()
        passwordRequest.cancel()
        updateRequest.cancel()
        platformJob?.cancel()
        platformActionRequest.cancel()
        signOutRequest.cancel()
        mutableState.value = AccountSettingsUiState()
        super.onCleared()
    }

    class Factory(
        private val username: String,
        private val repository: AccountRepository,
        private val platform: AccountPlatformSettings,
        private val api: MobileApiClient? = null,
        private val session: MemberSession? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AccountSettingsViewModel::class.java))
            return AccountSettingsViewModel(username, repository, platform, initialApi = api, initialSession = session) as T
        }
    }
}
