package org.trustroots.android.updates

import android.content.Context
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.BuildConfig

@RunWith(AndroidJUnit4::class)
class ApkUpdateAlertsJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()

    @Before
    fun savePreferences() {
        previousPreferences = preferences.all
    }

    @After
    fun restorePreferences() {
        WorkManager.getInstance(context).cancelUniqueWork(TEST_PERIODIC_WORK_NAME).result.get(5, TimeUnit.SECONDS)
        WorkManager.getInstance(context).cancelUniqueWork(TEST_WORKER_WORK_NAME).result.get(5, TimeUnit.SECONDS)
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        previousPreferences.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }

    @Test
    fun disabledPreviewBuildKeepsChecksUnavailableWithoutContactingReleaseService() = runBlocking {
        assumeFalse("This journey covers the disabled debug build", BuildConfig.PREVIEW_UPDATE_ALERTS)
        preferences.edit().remove("enabled").commit()

        ApkUpdateAlerts.setEnabled(context, true)
        ApkUpdateAlerts.reconcile(context)
        val result = ApkUpdateAlerts.checkNow(context)

        assertFalse(preferences.contains("enabled"))
        assertFalse(ApkUpdateAlerts.isEnabled(context))
        assertTrue(result is ApkUpdateCheckResult.Unavailable)
    }

    @Test
    fun enabledPreviewAlertsScheduleUniquePeriodicWorkAndDisablingCancelsIt() {
        val workManager = WorkManager.getInstance(context)
        workManager.cancelUniqueWork(TEST_PERIODIC_WORK_NAME).result.get(5, TimeUnit.SECONDS)
        preferences.edit().remove("enabled").commit()

        ApkUpdateAlerts.reconcile(context, previewAlertsEnabled = true, workName = TEST_PERIODIC_WORK_NAME)
        awaitWorkInfos(TEST_PERIODIC_WORK_NAME) { infos -> infos.none { !it.state.isFinished } }

        ApkUpdateAlerts.setEnabled(
            context,
            enabled = true,
            previewAlertsEnabled = true,
            workName = TEST_PERIODIC_WORK_NAME,
        )
        assertTrue(ApkUpdateAlerts.isEnabled(context, previewAlertsEnabled = true))
        val firstSchedule = awaitWorkInfos(TEST_PERIODIC_WORK_NAME) { infos -> infos.any { !it.state.isFinished } }
            .single { !it.state.isFinished }
        assertTrue(firstSchedule.state == WorkInfo.State.ENQUEUED || firstSchedule.state == WorkInfo.State.RUNNING)

        ApkUpdateAlerts.reconcile(context, previewAlertsEnabled = true, workName = TEST_PERIODIC_WORK_NAME)
        val reconciledSchedule = workManager.getWorkInfosForUniqueWork(TEST_PERIODIC_WORK_NAME).get(5, TimeUnit.SECONDS)
        assertEquals(firstSchedule.id, reconciledSchedule.single { !it.state.isFinished }.id)

        ApkUpdateAlerts.setEnabled(
            context,
            enabled = false,
            previewAlertsEnabled = true,
            workName = TEST_PERIODIC_WORK_NAME,
        )
        assertFalse(ApkUpdateAlerts.isEnabled(context, previewAlertsEnabled = true))
        awaitWorkInfos(TEST_PERIODIC_WORK_NAME) { infos -> infos.none { !it.state.isFinished } }
    }

    @Test
    fun disabledBuildSettingDoesNotChangePreferencesOrScheduleWork() {
        val workManager = WorkManager.getInstance(context)
        workManager.cancelUniqueWork(TEST_PERIODIC_WORK_NAME).result.get(5, TimeUnit.SECONDS)
        preferences.edit().remove("enabled").commit()

        ApkUpdateAlerts.setEnabled(
            context,
            enabled = true,
            previewAlertsEnabled = false,
            workName = TEST_PERIODIC_WORK_NAME,
        )

        assertFalse(preferences.contains("enabled"))
        awaitWorkInfos(TEST_PERIODIC_WORK_NAME) { infos -> infos.none { !it.state.isFinished } }
    }

    @Test
    fun workerCompletesSuccessfullyWhenTheDebugBuildHasNoPreviewUpdateService() {
        assumeFalse("This journey covers the disabled debug build", BuildConfig.PREVIEW_UPDATE_ALERTS)
        val workManager = WorkManager.getInstance(context)
        workManager.cancelUniqueWork(TEST_WORKER_WORK_NAME).result.get(5, TimeUnit.SECONDS)
        val request = OneTimeWorkRequestBuilder<ApkUpdateWorker>().build()

        workManager.enqueueUniqueWork(TEST_WORKER_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
            .result.get(5, TimeUnit.SECONDS)
        val timeoutAt = SystemClock.elapsedRealtime() + TimeUnit.SECONDS.toMillis(10)
        var state: WorkInfo.State? = null
        while (SystemClock.elapsedRealtime() < timeoutAt) {
            state = workManager.getWorkInfoById(request.id).get(5, TimeUnit.SECONDS)?.state
            if (state?.isFinished == true) break
            Thread.sleep(25)
        }

        assertEquals(WorkInfo.State.SUCCEEDED, state)
    }

    private fun awaitWorkInfos(
        workName: String,
        ready: (List<WorkInfo>) -> Boolean,
    ): List<WorkInfo> {
        val workManager = WorkManager.getInstance(context)
        val timeoutAt = SystemClock.elapsedRealtime() + TimeUnit.SECONDS.toMillis(10)
        var latest: List<WorkInfo> = emptyList()
        while (SystemClock.elapsedRealtime() < timeoutAt) {
            latest = workManager.getWorkInfosForUniqueWork(workName).get(5, TimeUnit.SECONDS)
            if (ready(latest)) return latest
            Thread.sleep(25)
        }
        assertTrue("WorkManager did not reach the expected state for $workName: $latest", ready(latest))
        return latest
    }

    private companion object {
        const val PREFERENCES_NAME = "apk-update-alerts"
        const val TEST_PERIODIC_WORK_NAME = "android-preview-update-test-periodic"
        const val TEST_WORKER_WORK_NAME = "android-preview-update-test-worker"
    }
}
