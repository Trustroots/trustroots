package org.trustroots.android.ui.account

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.updates.ApkUpdateCheckResult

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class AndroidAccountPlatformSettingsTest {
    @Test
    fun platformOperationsUseApplicationContextAndLatestSession() = runBlocking {
        val activityContext = ContextWrapper(RuntimeEnvironment.getApplication())
        val session = MemberSession("connect.sid=old", MobileMember("quiet-fox", "Quiet Fox"))
        val refreshedSession = MemberSession("connect.sid=refreshed", MobileMember("quiet-fox", "Quiet Fox"))
        val result = ApkUpdateCheckResult.UpToDate
        val contexts = mutableListOf<Context>()
        val changes = mutableListOf<Boolean>()
        var disabledSession: MemberSession? = null
        var checks = 0
        val settings = AndroidAccountPlatformSettings(
            context = activityContext,
            session = session,
            previewAlertsEnabled = true,
            isUpdateAlertsEnabled = { context -> contexts += context; true },
            setUpdateAlertsEnabled = { context, enabled -> contexts += context; changes += enabled },
            checkPreviewUpdates = { context -> contexts += context; checks++; result },
            disableMessageAlerts = { context, current -> contexts += context; disabledSession = current },
        )

        settings.updateSession(refreshedSession)
        settings.disableMessageAlerts()
        assertTrue(settings.updateAlertsEnabled())
        settings.setUpdateAlertsEnabled(false)
        assertSame(result, settings.checkPreviewUpdates())

        assertEquals(refreshedSession, disabledSession)
        assertEquals(listOf(false), changes)
        assertEquals(1, checks)
        assertTrue(contexts.all { it === activityContext.applicationContext })
    }

    @Test
    fun previewUpdateFlagShortCircuitsStoredPreferenceAndMessageAlertsDefaultOff() {
        val applicationContext = RuntimeEnvironment.getApplication() as Context
        var preferenceReads = 0
        val settings = AndroidAccountPlatformSettings(
            context = applicationContext,
            session = MemberSession("connect.sid=fixture", MobileMember("quiet-fox", "Quiet Fox")),
            previewAlertsEnabled = false,
            isUpdateAlertsEnabled = { preferenceReads++; true },
        )

        assertFalse(settings.updateAlertsEnabled())
        assertEquals(0, preferenceReads)
        assertFalse(settings.messageAlertsEnabled("fictional-member"))
    }
}
