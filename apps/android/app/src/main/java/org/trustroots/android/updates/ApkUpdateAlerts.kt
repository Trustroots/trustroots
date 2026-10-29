package org.trustroots.android.updates

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.trustroots.android.BuildConfig
import org.trustroots.android.R

internal data class AndroidPreviewRelease(
    val versionCode: Int,
    val versionName: String,
    val pageUrl: String,
)

internal fun latestAndroidPreviewRelease(
    response: String,
    installedVersionCode: Int,
    fallbackVersionName: (Int) -> String,
): AndroidPreviewRelease? {
    val releases = JSONArray(response)
    val tagPattern = Regex("^android-preview-[0-9]+(?:-v[0-9A-Za-z._-]+)?$")
    val buildPattern = Regex("\\bBuild ([0-9]+)\\b")
    val apkPattern = Regex("^trustroots-android-[0-9A-Za-z._-]+\\.apk$")
    return (0 until releases.length()).mapNotNull { index ->
        val release = releases.optJSONObject(index) ?: return@mapNotNull null
        if (release.optBoolean("draft") || !release.optBoolean("prerelease")) return@mapNotNull null
        val tag = release.optString("tag_name")
        if (!tagPattern.matches(tag)) return@mapNotNull null
        val versionCode = buildPattern.find(release.optString("body"))
            ?.groupValues?.get(1)?.toIntOrNull() ?: return@mapNotNull null
        if (versionCode <= installedVersionCode) return@mapNotNull null
        val assets = release.optJSONArray("assets") ?: return@mapNotNull null
        val hasApk = (0 until assets.length()).any { assetIndex ->
            val asset = assets.optJSONObject(assetIndex)
            asset != null && apkPattern.matches(asset.optString("name")) && asset.optLong("size") > 0
        }
        if (!hasApk) return@mapNotNull null
        AndroidPreviewRelease(
            versionCode = versionCode,
            versionName = release.optString("name").ifBlank { fallbackVersionName(versionCode) },
            pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/$tag",
        )
    }.maxByOrNull { it.versionCode }
}

internal sealed interface ApkUpdateCheckResult {
    data object UpToDate : ApkUpdateCheckResult
    data class NewVersion(val release: AndroidPreviewRelease) : ApkUpdateCheckResult
    data object Unavailable : ApkUpdateCheckResult
}

internal suspend fun checkForAndroidPreviewUpdate(
    isEnabled: () -> Boolean,
    fetchRelease: suspend () -> AndroidPreviewRelease?,
    notify: (AndroidPreviewRelease) -> Unit,
): ApkUpdateCheckResult = withContext(Dispatchers.IO) {
    if (!isEnabled()) return@withContext ApkUpdateCheckResult.Unavailable
    val release = try {
        fetchRelease()
    } catch (_: Exception) {
        return@withContext ApkUpdateCheckResult.Unavailable
    }
    if (!isEnabled()) return@withContext ApkUpdateCheckResult.Unavailable
    if (release == null) return@withContext ApkUpdateCheckResult.UpToDate
    notify(release)
    ApkUpdateCheckResult.NewVersion(release)
}

internal fun shouldPostUpdateNotification(
    notificationsEnabled: Boolean,
    permissionGranted: Boolean,
    alertsEnabled: Boolean,
    versionCode: Int,
    lastNotifiedVersionCode: Int,
): Boolean = notificationsEnabled && permissionGranted && alertsEnabled &&
    versionCode > lastNotifiedVersionCode

internal object ApkUpdateAlerts {
    private const val WORK_NAME = "android-preview-update-check"
    private const val CHANNEL_ID = "apk-updates"
    private const val NOTIFICATION_ID = 701
    private const val PREFS_NAME = "apk-update-alerts"
    private const val ENABLED = "enabled"
    private const val LAST_NOTIFIED = "last-notified-version-code"
    private const val RELEASES_URL =
        "https://api.github.com/repos/Trustroots/trustroots/releases?per_page=100"
    private val notificationLock = Any()

    fun isEnabled(context: Context): Boolean = isEnabled(context, BuildConfig.PREVIEW_UPDATE_ALERTS)

    internal fun isEnabled(context: Context, previewAlertsEnabled: Boolean): Boolean =
        previewAlertsEnabled &&
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) =
        setEnabled(context, enabled, BuildConfig.PREVIEW_UPDATE_ALERTS)

    internal fun setEnabled(
        context: Context,
        enabled: Boolean,
        previewAlertsEnabled: Boolean,
        workName: String = WORK_NAME,
    ) {
        if (!previewAlertsEnabled) return
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(ENABLED, enabled).apply()
        if (enabled) schedule(context, workName) else WorkManager.getInstance(context).cancelUniqueWork(workName)
    }

    fun reconcile(context: Context) = reconcile(context, BuildConfig.PREVIEW_UPDATE_ALERTS)

    internal fun reconcile(
        context: Context,
        previewAlertsEnabled: Boolean,
        workName: String = WORK_NAME,
    ) {
        if (isEnabled(context, previewAlertsEnabled)) schedule(context, workName)
    }

    private fun schedule(context: Context, workName: String) {
        val request = PeriodicWorkRequestBuilder<ApkUpdateWorker>(1, TimeUnit.DAYS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            workName,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    suspend fun checkNow(context: Context): ApkUpdateCheckResult =
        checkNow(context, BuildConfig.PREVIEW_UPDATE_ALERTS, RELEASES_URL)

    internal suspend fun checkNow(
        context: Context,
        previewAlertsEnabled: Boolean,
        releasesUrl: String,
        postNotification: (NotificationManager, Int, Notification) -> Unit = { manager, id, notification ->
            manager.notify(id, notification)
        },
    ): ApkUpdateCheckResult = checkForAndroidPreviewUpdate(
        isEnabled = { isEnabled(context, previewAlertsEnabled) },
        fetchRelease = { fetchLatestRelease(context, releasesUrl) },
        notify = { notifyOnce(context, it, previewAlertsEnabled, postNotification) },
    )

    private fun fetchLatestRelease(context: Context, releasesUrl: String): AndroidPreviewRelease? {
        val connection = URL(releasesUrl).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "TrustrootsAndroid/${BuildConfig.VERSION_NAME}")
        return try {
            if (connection.responseCode !in 200..299) error("Release request failed")
            val response = connection.inputStream.reader().use { it.readText() }
            latestAndroidPreviewRelease(response, BuildConfig.VERSION_CODE) { versionCode ->
                context.getString(R.string.android_preview_version, versionCode)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun notifyOnce(
        context: Context,
        release: AndroidPreviewRelease,
        previewAlertsEnabled: Boolean,
        postNotification: (NotificationManager, Int, Notification) -> Unit,
    ) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val permissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        synchronized(notificationLock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!shouldPostUpdateNotification(
                    notificationsEnabled = manager.areNotificationsEnabled(),
                    permissionGranted = permissionGranted,
                    alertsEnabled = isEnabled(context, previewAlertsEnabled),
                    versionCode = release.versionCode,
                    lastNotifiedVersionCode = prefs.getInt(LAST_NOTIFIED, 0),
                )
            ) return
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, context.getString(R.string.apk_updates_channel), NotificationManager.IMPORTANCE_DEFAULT),
            )
            val openRelease = Intent(Intent.ACTION_VIEW, Uri.parse(release.pageUrl))
            val contentIntent = PendingIntent.getActivity(
                context,
                release.versionCode,
                openRelease,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_update_notification)
                .setContentTitle(context.getString(R.string.apk_update_available_title))
                .setContentText(context.getString(R.string.apk_update_available_text, release.versionName))
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .build()
            try {
                postNotification(manager, NOTIFICATION_ID, notification)
            } catch (_: SecurityException) {
                // Permission may have been revoked after the check above.
                return
            }
            prefs.edit().putInt(LAST_NOTIFIED, release.versionCode).apply()
        }
    }
}

class ApkUpdateWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        ApkUpdateAlerts.checkNow(applicationContext)
        return Result.success()
    }
}
