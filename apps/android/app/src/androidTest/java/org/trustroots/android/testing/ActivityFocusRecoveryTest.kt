package org.trustroots.android.testing

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ActivityFocusRecoveryTest {
    @Test fun recoversOnlyTheSystemProcessWhoseAnrDialogHasWindowFocus() {
        for (process in listOf("com.android.launcher3", "com.android.systemui")) {
            val commands = recoverWith("""
                mCurrentFocus=Window{abc u0 Application Not Responding: $process}
                mFocusedApp=ActivityRecord{def u0 org.trustroots.android.debug/androidx.activity.ComponentActivity}
            """.trimIndent())

            val recovery = if (process == "com.android.systemui") "wait for System UI" else "am force-stop $process"
            assertEquals(listOf("dumpsys window windows", recovery), commands)
        }
    }

    @Test fun doesNotDismissAnApplicationOrAnotherSystemProcessAnr() {
        for (process in listOf("org.trustroots.android.debug", "com.android.settings", "com.android.launcher3.other", "com.android.systemui.other")) {
            assertEquals(
                listOf("dumpsys window windows"),
                recoverWith("mCurrentFocus=Window{abc u0 Application Not Responding: $process}"),
            )
        }
    }

    @Test fun doesNotActOnAnUnfocusedSystemAnrOrAMissingFocusWindow() {
        for (dump in listOf(
            """
                Window #1 Window{abc u0 Application Not Responding: com.android.launcher3}
                mCurrentFocus=Window{def u0 org.trustroots.android.debug/androidx.activity.ComponentActivity}
            """.trimIndent(),
            """
                Window #1 Window{abc u0 Application Not Responding: com.android.systemui}
                mCurrentFocus=Window{def u0 org.trustroots.android.debug/androidx.activity.ComponentActivity}
            """.trimIndent(),
            "mCurrentFocus=null",
            "No device output",
        )) {
            assertEquals(listOf("dumpsys window windows"), recoverWith(dump))
        }
    }

    private fun recoverWith(dump: String): List<String> {
        val commands = mutableListOf<String>()
        dismissSystemAnr(
            shell = { command ->
                commands += command
                if (command == "dumpsys window windows") dump else ""
            },
            waitForSystemUi = { commands += "wait for System UI"; true },
        )
        return commands
    }
}
