package org.trustroots.android.updates

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
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

    private companion object {
        const val PREFERENCES_NAME = "apk-update-alerts"
    }
}
