package org.trustroots.android.notifications

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import org.trustroots.android.BuildConfig
import org.trustroots.android.MainActivity
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.SecureMobileSessionStore
import org.unifiedpush.android.connector.PushService
import org.unifiedpush.android.connector.UnifiedPush
import org.unifiedpush.android.connector.FailedReason
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage

data class MessageDestination(val account: String, val senderId: String)

/** Resource identity and safe formatting values for Account UI status copy. */
data class MessageAlertStatusMetadata(val resourceId: Int, val formatArgs: List<String> = emptyList())

internal suspend fun handleMessageEndpointRegistration(
    account: String,
    endpointUrl: String,
    publicKey: String,
    authKey: String,
    loadSession: suspend () -> MemberSession?,
    registerEndpoint: suspend (MemberSession, String, String, String) -> Boolean,
    saveEndpoint: (String) -> String?,
    unregisterEndpoint: suspend (MemberSession, String) -> Unit,
    setStatus: (String) -> Unit,
    registrationFailedMessage: String,
    registrationSucceededMessage: String,
    setStatusMetadata: (MessageAlertStatusMetadata) -> Unit = {},
    registrationFailedMetadata: MessageAlertStatusMetadata? = null,
    registrationSucceededMetadata: MessageAlertStatusMetadata? = null,
) {
    val session = loadSession() ?: return
    if (session.member.username != account) return
    if (!registerEndpoint(session, endpointUrl, publicKey, authKey)) {
        setStatus(registrationFailedMessage)
        registrationFailedMetadata?.let(setStatusMetadata)
        return
    }
    val oldEndpoint = saveEndpoint(endpointUrl)
    if (oldEndpoint != null && oldEndpoint != endpointUrl) {
        unregisterEndpoint(session, oldEndpoint)
    }
    setStatus(registrationSucceededMessage)
    registrationSucceededMetadata?.let(setStatusMetadata)
}

object MessageAlerts {
    const val ACCOUNT_EXTRA = "org.trustroots.android.message.account"
    const val SENDER_EXTRA = "org.trustroots.android.message.sender"
    val destination = MutableStateFlow<MessageDestination?>(null)
    val status = MutableStateFlow<String?>(null)
    val statusMetadata = MutableStateFlow<MessageAlertStatusMetadata?>(null)
    private const val CHANNEL = "messages"
    private const val PREFS = "message-alerts"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun preferences(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isEnabled(context: Context, account: String): Boolean =
        preferences(context).getString("account", null) == account &&
            preferences(context).getBoolean("enabled", false)

    fun endpoint(context: Context): String? = preferences(context).getString("endpoint", null)

    fun captureIntent(intent: Intent?) {
        val account = intent?.getStringExtra(ACCOUNT_EXTRA) ?: return
        val sender = intent.getStringExtra(SENDER_EXTRA) ?: return
        destination.value = MessageDestination(account, sender)
    }

    fun clearDestination() { destination.value = null }

    fun enable(activity: Activity, session: MemberSession, onResult: (String) -> Unit) {
        enableWithStatus(
            activity = activity,
            session = session,
            onResult = { result -> onResult(activity.getString(result.resourceId, *result.formatArgs.toTypedArray())) },
            apiBaseUrl = BuildConfig.API_BASE_URL,
            hasDistributors = { UnifiedPush.getDistributors(activity).isNotEmpty() },
            chooseDistributor = { onSelected -> UnifiedPush.tryUseCurrentOrDefaultDistributor(activity, onSelected) },
            registerDistributor = { key ->
                UnifiedPush.register(
                    activity,
                    messageForDistributor = activity.getString(R.string.message_alerts_push_name),
                    vapid = key,
                )
            },
        )
    }

    fun enableWithStatus(activity: Activity, session: MemberSession, onResult: (MessageAlertStatusMetadata) -> Unit) {
        enableWithStatus(
            activity = activity,
            session = session,
            onResult = onResult,
            apiBaseUrl = BuildConfig.API_BASE_URL,
            hasDistributors = { UnifiedPush.getDistributors(activity).isNotEmpty() },
            chooseDistributor = { onSelected -> UnifiedPush.tryUseCurrentOrDefaultDistributor(activity, onSelected) },
            registerDistributor = { key ->
                UnifiedPush.register(
                    activity,
                    messageForDistributor = activity.getString(R.string.message_alerts_push_name),
                    vapid = key,
                )
            },
        )
    }

    internal fun enable(
        activity: Activity,
        session: MemberSession,
        onResult: (String) -> Unit,
        apiBaseUrl: String,
        hasDistributors: () -> Boolean,
        chooseDistributor: ((Boolean) -> Unit) -> Unit,
        registerDistributor: (String) -> Unit,
    ) = enableWithStatus(
        activity = activity,
        session = session,
        onResult = { result -> onResult(activity.getString(result.resourceId, *result.formatArgs.toTypedArray())) },
        apiBaseUrl = apiBaseUrl,
        hasDistributors = hasDistributors,
        chooseDistributor = chooseDistributor,
        registerDistributor = registerDistributor,
    )

    internal fun enableWithStatus(
        activity: Activity,
        session: MemberSession,
        onResult: (MessageAlertStatusMetadata) -> Unit,
        apiBaseUrl: String,
        hasDistributors: () -> Boolean,
        chooseDistributor: ((Boolean) -> Unit) -> Unit,
        registerDistributor: (String) -> Unit,
    ) {
        scope.launch {
            val key = MobileApiClient(apiBaseUrl).messagePushConfiguration(session).getOrNull()
            activity.runOnUiThread {
                if (key.isNullOrBlank()) {
                    onResult(MessageAlertStatusMetadata(R.string.message_alerts_not_configured))
                    return@runOnUiThread
                }
                if (!hasDistributors()) {
                    onResult(MessageAlertStatusMetadata(R.string.message_alerts_install_distributor))
                    return@runOnUiThread
                }
                chooseDistributor { selected ->
                    if (!selected) {
                        onResult(MessageAlertStatusMetadata(R.string.message_alerts_choose_distributor))
                    } else {
                        preferences(activity).edit().putString("account", session.member.username)
                            .putBoolean("enabled", true).apply()
                        registerDistributor(key)
                        status.value = null
                        statusMetadata.value = null
                        onResult(MessageAlertStatusMetadata(R.string.message_alerts_waiting_registration))
                    }
                }
            }
        }
    }

    fun reconcile(context: Context, session: MemberSession) {
        reconcile(
            context = context,
            session = session,
            apiBaseUrl = BuildConfig.API_BASE_URL,
            hasSavedDistributor = { UnifiedPush.getSavedDistributor(context) != null },
            registerDistributor = { key ->
                UnifiedPush.register(
                    context,
                    messageForDistributor = context.getString(R.string.message_alerts_push_name),
                    vapid = key,
                )
            },
        )
    }

    internal fun reconcile(
        context: Context,
        session: MemberSession,
        apiBaseUrl: String,
        hasSavedDistributor: () -> Boolean,
        registerDistributor: (String) -> Unit,
    ): Job? {
        if (!isEnabled(context, session.member.username)) {
            status.value = null
            statusMetadata.value = null
            return null
        }
        return scope.launch {
            val key = MobileApiClient(apiBaseUrl).messagePushConfiguration(session).getOrNull() ?: return@launch
            if (hasSavedDistributor()) {
                registerDistributor(key)
            }
        }
    }

    suspend fun disable(context: Context, session: MemberSession) {
        disable(context, session, BuildConfig.API_BASE_URL) { UnifiedPush.unregister(context) }
    }

    internal suspend fun disable(
        context: Context,
        session: MemberSession,
        apiBaseUrl: String,
        unregisterDistributor: () -> Unit,
    ) {
        val oldEndpoint = endpoint(context)
        preferences(context).edit().clear().apply()
        status.value = null
        statusMetadata.value = null
        unregisterDistributor()
        if (oldEndpoint != null) {
            MobileApiClient(apiBaseUrl).unregisterMessagePush(session, oldEndpoint)
        }
    }

    fun onEndpoint(context: Context, newEndpoint: PushEndpoint) {
        onEndpoint(context, newEndpoint, BuildConfig.API_BASE_URL) { SecureMobileSessionStore(context).load() }
    }

    internal fun onEndpoint(
        context: Context,
        newEndpoint: PushEndpoint,
        apiBaseUrl: String,
        loadSession: suspend () -> MemberSession?,
    ) {
        val account = preferences(context).getString("account", null) ?: return
        if (!isEnabled(context, account)) return
        val keys = newEndpoint.pubKeySet ?: run {
            status.value = context.getString(R.string.message_alerts_missing_encryption_keys)
            statusMetadata.value = MessageAlertStatusMetadata(R.string.message_alerts_missing_encryption_keys)
            return
        }
        scope.launch {
            val api = MobileApiClient(apiBaseUrl)
            handleMessageEndpointRegistration(
                account = account,
                endpointUrl = newEndpoint.url,
                publicKey = keys.pubKey,
                authKey = keys.auth,
                loadSession = loadSession,
                registerEndpoint = { session, url, publicKey, authKey ->
                    api.registerMessagePush(session, url, publicKey, authKey).isSuccess
                },
                saveEndpoint = { url ->
                    val oldEndpoint = endpoint(context)
                    preferences(context).edit().putString("endpoint", url).apply()
                    oldEndpoint
                },
                unregisterEndpoint = { session, oldUrl -> api.unregisterMessagePush(session, oldUrl) },
                setStatus = { status.value = it },
                registrationFailedMessage = context.getString(R.string.message_alerts_registration_failed),
                registrationSucceededMessage = context.getString(R.string.message_alerts_ready),
                setStatusMetadata = { statusMetadata.value = it },
                registrationFailedMetadata = MessageAlertStatusMetadata(R.string.message_alerts_registration_failed),
                registrationSucceededMetadata = MessageAlertStatusMetadata(R.string.message_alerts_ready),
            )
        }
    }

    fun onDistributorUnregistered(context: Context) {
        onDistributorUnregistered(
            context = context,
            apiBaseUrl = BuildConfig.API_BASE_URL,
            loadSession = { SecureMobileSessionStore(context).load() },
        )
    }

    internal fun onDistributorUnregistered(
        context: Context,
        apiBaseUrl: String,
        loadSession: suspend () -> MemberSession?,
    ): Job? {
        val account = preferences(context).getString("account", null) ?: return null
        if (!isEnabled(context, account)) return null
        val oldEndpoint = endpoint(context)
        preferences(context).edit().clear().apply()
        status.value = context.getString(R.string.message_alerts_distributor_stopped)
        statusMetadata.value = MessageAlertStatusMetadata(R.string.message_alerts_distributor_stopped)
        return oldEndpoint?.let {
            scope.launch {
                val session = loadSession() ?: return@launch
                if (session.member.username == account) {
                    MobileApiClient(apiBaseUrl).unregisterMessagePush(session, it)
                }
            }
        }
    }

    fun show(context: Context, message: PushMessage) {
        if (!message.decrypted) return
        val senderId = senderIdFromPushPayload(message.content.toString(Charsets.UTF_8)) ?: return
        val session = SecureMobileSessionStore(context).load() ?: return
        if (!isEnabled(context, session.member.username)) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val notifications = context.getSystemService(NotificationManager::class.java)
        notifications.createNotificationChannel(NotificationChannel(
            CHANNEL, context.getString(R.string.message_alerts_channel), NotificationManager.IMPORTANCE_DEFAULT,
        ))
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(ACCOUNT_EXTRA, session.member.username)
            .putExtra(SENDER_EXTRA, senderId)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(
            context, senderId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        notifications.notify(senderId.hashCode(), Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.message_alerts_notification_title))
            .setContentText(context.getString(R.string.message_alerts_notification_text))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build())
    }
}

class MessagePushService : PushService() {
    override fun onNewEndpoint(endpoint: PushEndpoint, instance: String) = MessageAlerts.onEndpoint(this, endpoint)
    override fun onMessage(message: PushMessage, instance: String) = MessageAlerts.show(this, message)
    override fun onRegistrationFailed(reason: FailedReason, instance: String) {
        MessageAlerts.status.value = getString(R.string.message_alerts_registration_error, reason.name)
        MessageAlerts.statusMetadata.value = MessageAlertStatusMetadata(
            R.string.message_alerts_registration_error,
            listOf(reason.name),
        )
    }
    override fun onUnregistered(instance: String) = MessageAlerts.onDistributorUnregistered(this)
}
