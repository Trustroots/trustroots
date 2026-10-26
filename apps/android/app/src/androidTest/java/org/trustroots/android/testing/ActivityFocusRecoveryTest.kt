package org.trustroots.android.testing

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ActivityFocusRecoveryTest {
    @Test fun readsTheFocusedSystemAnrFromActivityDumpAndWaitsOnlyForExactMatches() {
        for (process in listOf("com.android.launcher3", "com.android.systemui")) {
            val commands = recoverWith("""
                mCurrentFocus=Window{abc u0 Application Not Responding: $process}
                mFocusedApp=ActivityRecord{def u0 org.trustroots.android.debug/androidx.activity.ComponentActivity}
            """.trimIndent())

            assertEquals(listOf("dumpsys activity activities", "wait for matched system ANR"), commands)
        }
    }

    @Test fun doesNotDismissAnApplicationOrAnotherSystemProcessAnr() {
        for (process in listOf("org.trustroots.android.debug", "com.android.settings", "com.android.launcher3.other", "com.android.systemui.other")) {
            assertEquals(
                listOf("dumpsys activity activities"),
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
            assertEquals(listOf("dumpsys activity activities"), recoverWith(dump))
        }
    }

    private fun recoverWith(dump: String): List<String> {
        val commands = mutableListOf<String>()
        dismissSystemAnr(
            shell = { command ->
                commands += command
                when (command) {
                    "dumpsys window windows" -> "mTopFocusedDisplayId=0"
                    "dumpsys activity activities" -> dump
                    else -> ""
                }
            },
            waitForSystemAnr = { commands += "wait for matched system ANR"; true },
        )
        return commands
    }
}
