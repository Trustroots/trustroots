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
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import org.trustroots.android.MainActivity
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.nostr.AndroidNostrKeys
import org.trustroots.android.nostr.NostrEventSigner
import org.trustroots.android.nostr.NostrKeyCodec
import org.trustroots.android.nostr.nostrAccountScope
import org.unifiedpush.android.connector.UnifiedPush
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage

internal object NostranslationAlerts {
    const val instance = "nostranslation"
    private const val openExtra = "org.trustroots.android.OPEN_NOSTRANSLATION_REVIEW"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val writeLock = Mutex()
    val openRequested = MutableStateFlow<String?>(null)
    val status = MutableStateFlow<Int?>(null)

    private fun prefs(context: Context) = context.getSharedPreferences("nostranslation-alerts", Context.MODE_PRIVATE)
    private fun account(backend: String, session: MemberSession) =
        nostrAccountScope(backend, session.member.username).storageAccount

    fun isEnabled(context: Context, backend: String, session: MemberSession): Boolean =
        prefs(context).getBoolean(account(backend, session), false)

    fun captureIntent(intent: Intent?) {
        intent?.getStringExtra(openExtra)?.let { openRequested.value = it }
    }

    fun enable(activity: Activity, api: MobileApiClient, session: MemberSession) {
        scope.launch {
            val vapid = runCatching { api.translationAlertVapidKey(session) }.getOrNull()
            if (vapid == null) {
                status.value = R.string.nostranslation_alerts_unavailable
                return@launch
            }
            UnifiedPush.tryUseCurrentOrDefaultDistributor(activity) { ready ->
                if (!ready) {
                    status.value = R.string.nostranslation_alerts_unavailable
                    return@tryUseCurrentOrDefaultDistributor
                }
                prefs(activity).edit().putBoolean(account(api.backendURL, session), true)
                    .putString("backend", api.backendURL).apply()
                registerDistributor(activity, vapid)
            }
        }
    }

    fun reconcile(context: Context, api: MobileApiClient, session: MemberSession) {
        if (!isEnabled(context, api.backendURL, session) || UnifiedPush.getSavedDistributor(context) == null) return
        prefs(context).edit().putString("backend", api.backendURL).apply()
        scope.launch {
            runCatching { api.translationAlertVapidKey(session) }.getOrNull()?.let { registerDistributor(context, it) }
        }
    }

    fun disable(context: Context, api: MobileApiClient, session: MemberSession) {
        val id = account(api.backendURL, session)
        prefs(context).edit().remove(id).apply()
        status.value = null
        UnifiedPush.unregister(context, instance)
        scope.launch {
            writeLock.withLock {
                val prior = prefs(context).getStringSet("$id:registered", emptySet()).orEmpty()
                val remaining = prior.filterTo(mutableSetOf()) {
                    runCatching { api.unregisterTranslationAlert(session, it) }.isFailure
                }
                prefs(context).edit().putStringSet("$id:registered", remaining).apply()
            }
        }
    }

    private fun registerDistributor(context: Context, vapid: String) {
        UnifiedPush.register(
            context, instance = instance,
            messageForDistributor = context.getString(R.string.nostranslation_signing), vapid = vapid,
        )
    }

    fun onEndpoint(context: Context, endpoint: PushEndpoint) {
        val keySet = endpoint.pubKeySet ?: return registrationFailed()
        scope.launch {
            val store = SecureMobileSessionStore(context)
            val session = store.load() ?: return@launch
            val backend = prefs(context).getString("backend", null) ?: return@launch
            if (!isEnabled(context, backend, session)) return@launch
            val api = MobileApiClient(backend, sessionStore = store)
            val destination = JSONObject().put("platform", "android").put("endpoint", endpoint.url)
                .put("publicKey", keySet.pubKey).put("auth", keySet.auth)
            val success = writeLock.withLock {
                runCatching { sync(context, session, api, destination) }.isSuccess
            }
            status.value = if (success) R.string.nostranslation_alerts_ready else R.string.nostranslation_alerts_unavailable
        }
    }

    private suspend fun sync(context: Context, session: MemberSession, api: MobileApiClient, destination: JSONObject) {
        val account = nostrAccountScope(api.backendURL, session.member.username)
        val keys = AndroidNostrKeys(context, account)
        val revision = keys.revision()
        val previous = prefs(context).getStringSet("${account.storageAccount}:registered", emptySet()).orEmpty()
        val current = mutableSetOf<String>()
        if (keys.browserPublicKey(revision) != null) {
            val records = keys.loadPairings(revision)
            for (index in 0 until records.length()) {
                check(isEnabled(context, api.backendURL, session))
                val record = records.getJSONObject(index)
                val author = record.getString("peer")
                val secret = NostrKeyCodec.import(record.getString("transport"))
                try {
                    val transport = NostrEventSigner.publicKey(secret)
                    val registration = JSONObject().put("author", author).put("transport", transport)
                        .put("destination", destination)
                    api.registerTranslationAlert(session, registration) { challenge ->
                        check(keys.revision() == revision && isEnabled(context, api.backendURL, session))
                        signNostranslationAlertChallenge(challenge, api.backendURL, author, transport, destination, secret)
                    }
                    current.add(transport)
                    prefs(context).edit().putStringSet("${account.storageAccount}:registered", previous + current).apply()
                } finally {
                    secret.fill(0)
                }
            }
        }
        for (removed in previous - current) api.unregisterTranslationAlert(session, removed)
        prefs(context).edit().putStringSet("${account.storageAccount}:registered", current).apply()
    }

    fun registrationFailed() { status.value = R.string.nostranslation_alerts_unavailable }

    fun show(context: Context, message: PushMessage) {
        if (!message.decrypted) return
        val payload = runCatching { JSONObject(message.content.toString(Charsets.UTF_8)) }.getOrNull() ?: return
        if (payload.optString("type") != "nostranslation-review") return
        val session = SecureMobileSessionStore(context).load() ?: return
        val backend = prefs(context).getString("backend", null) ?: return
        if (!isEnabled(context, backend, session)) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(
            instance, context.getString(R.string.nostranslation_signing), NotificationManager.IMPORTANCE_DEFAULT,
        ))
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(openExtra, account(backend, session))
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(context, 46, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        manager.notify(instance, 0, Notification.Builder(context, instance)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.nostranslation_signing))
            .setContentText(context.getString(R.string.nostranslation_review_waiting))
            .setContentIntent(pending).setAutoCancel(true).build())
    }
}

internal fun signNostranslationAlertChallenge(
    event: JSONObject,
    backend: String,
    peer: String,
    transport: String,
    destination: JSONObject,
    secret: ByteArray,
    now: Long = System.currentTimeMillis() / 1000,
): JSONObject {
    val fields = listOf(peer, transport, "android", destination.getString("endpoint"),
        destination.getString("publicKey"), destination.getString("auth"))
    val binding = fields.joinToString("") { "${it.encodeToByteArray().size}:$it" }
    val payload = MessageDigest.getInstance("SHA-256").digest(binding.encodeToByteArray())
        .joinToString("") { "%02x".format(it.toInt() and 255) }
    val created = event.getLong("created_at")
    require(event.get("kind") == 27235 && event.get("content") == "" && created in (now - 120)..(now + 30))
    val tags = event.getJSONArray("tags")
    require(tags.length() == 4)
    val values = (0 until tags.length()).associate { index ->
        val tag = tags.getJSONArray(index)
        require(tag.length() == 2)
        tag.get(0) as String to tag.get(1) as String
    }
    require(values["u"] == "${backend.trimEnd('/')}/api/mobile/v0/nostranslation/alerts" && values["method"] == "PUT" &&
        values["payload"] == payload && values["challenge"]?.matches(Regex("[0-9a-f]{64}")) == true)
    return NostrEventSigner.sign(event, secret)
}
