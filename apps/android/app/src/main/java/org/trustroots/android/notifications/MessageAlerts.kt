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

object MessageAlerts {
    const val ACCOUNT_EXTRA = "org.trustroots.android.message.account"
    const val SENDER_EXTRA = "org.trustroots.android.message.sender"
    val destination = MutableStateFlow<MessageDestination?>(null)
    val status = MutableStateFlow<String?>(null)
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
        scope.launch {
            val key = MobileApiClient(BuildConfig.API_BASE_URL).messagePushConfiguration(session).getOrNull()
            activity.runOnUiThread {
                if (key.isNullOrBlank()) {
                    onResult("Message alerts are not configured on this server.")
                    return@runOnUiThread
                }
                if (UnifiedPush.getDistributors(activity).isEmpty()) {
                    onResult("Install a UnifiedPush distributor such as ntfy, then try again.")
                    return@runOnUiThread
                }
                UnifiedPush.tryUseCurrentOrDefaultDistributor(activity) { selected ->
                    if (!selected) {
                        onResult("Choose a UnifiedPush distributor to enable message alerts.")
                    } else {
                        preferences(activity).edit().putString("account", session.member.username)
                            .putBoolean("enabled", true).apply()
                        UnifiedPush.register(activity, messageForDistributor = "Trustroots messages", vapid = key)
                        status.value = null
                        onResult("Waiting for your distributor to register message alerts.")
                    }
                }
            }
        }
    }

    fun reconcile(context: Context, session: MemberSession) {
        if (!isEnabled(context, session.member.username)) {
            status.value = null
            return
        }
        scope.launch {
            val key = MobileApiClient(BuildConfig.API_BASE_URL)
                .messagePushConfiguration(session).getOrNull() ?: return@launch
            if (UnifiedPush.getSavedDistributor(context) != null) {
                UnifiedPush.register(context, messageForDistributor = "Trustroots messages", vapid = key)
            }
        }
    }

    suspend fun disable(context: Context, session: MemberSession) {
        val oldEndpoint = endpoint(context)
        preferences(context).edit().clear().apply()
        status.value = null
        UnifiedPush.unregister(context)
        if (oldEndpoint != null) {
            MobileApiClient(BuildConfig.API_BASE_URL).unregisterMessagePush(session, oldEndpoint)
        }
    }

    fun onEndpoint(context: Context, newEndpoint: PushEndpoint) {
        val account = preferences(context).getString("account", null) ?: return
        if (!isEnabled(context, account)) return
        val keys = newEndpoint.pubKeySet ?: run {
            status.value = "This distributor did not provide Web Push encryption keys."
            return
        }
        scope.launch {
            val session = SecureMobileSessionStore(context).load() ?: return@launch
            if (session.member.username != account) return@launch
            val api = MobileApiClient(BuildConfig.API_BASE_URL)
            if (api.registerMessagePush(session, newEndpoint.url, keys.pubKey, keys.auth).isSuccess) {
                val oldEndpoint = endpoint(context)
                preferences(context).edit().putString("endpoint", newEndpoint.url).apply()
                if (oldEndpoint != null && oldEndpoint != newEndpoint.url) {
                    api.unregisterMessagePush(session, oldEndpoint)
                }
                status.value = "Message alerts are ready."
            } else {
                status.value = "Could not register this distributor endpoint with Trustroots."
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
            CHANNEL, "Messages", NotificationManager.IMPORTANCE_DEFAULT,
        ))
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(ACCOUNT_EXTRA, session.member.username)
            .putExtra(SENDER_EXTRA, senderId)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(
            context, senderId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        notifications.notify(senderId.hashCode(), Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.trustroots_launcher)
            .setContentTitle("Unread message")
            .setContentText("You have an unread Trustroots conversation.")
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build())
    }
}

class MessagePushService : PushService() {
    override fun onNewEndpoint(endpoint: PushEndpoint, instance: String) = MessageAlerts.onEndpoint(this, endpoint)
    override fun onMessage(message: PushMessage, instance: String) = MessageAlerts.show(this, message)
    override fun onRegistrationFailed(reason: FailedReason, instance: String) {
        MessageAlerts.status.value = "Push distributor registration failed: ${reason.name}."
    }
    override fun onUnregistered(instance: String) = Unit
}
