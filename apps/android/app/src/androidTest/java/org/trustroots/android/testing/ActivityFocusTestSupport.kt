package org.trustroots.android.testing

import android.app.Activity
import android.app.ActivityManager
import android.app.UiAutomation
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.junit4.ComposeTestRule
import android.view.View

/** Foregrounds the test's existing task, then asks its real decor view to take focus. */
internal fun foregroundActivityTask(
    compose: ComposeTestRule,
    activity: Activity,
    uiAutomation: UiAutomation,
) {
    val taskId = activity.taskId
    val appTask = activity.getSystemService(ActivityManager::class.java)
        .appTasks
        .firstOrNull { appTaskTaskId(it) == taskId }
        ?: throw AssertionError("No app task found for test Activity taskId=$taskId; ${activityFocusDiagnostics(activity, uiAutomation)}")

    appTask.moveToFront()
    compose.runOnUiThread { activity.window.decorView.requestFocus() }
    try {
        compose.waitUntil(5_000) { activity.hasWindowFocus() }
    } catch (error: ComposeTimeoutException) {
        throw AssertionError(
            "Test Activity task did not regain real window focus: taskId=$taskId; " +
                activityFocusDiagnostics(activity, uiAutomation),
            error,
        )
    }
}

private fun appTaskTaskId(appTask: ActivityManager.AppTask): Int? {
    val taskInfo = appTask.taskInfo ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) taskInfo.taskId else taskInfo.id
}

internal fun activityFocusDiagnostics(activity: Activity, uiAutomation: UiAutomation): String {
    val decor = activity.window.decorView
    val roots = runCatching {
        val manager = Class.forName("android.view.WindowManagerGlobal")
        val instance = manager.getMethod("getInstance").invoke(null)
        val views = manager.getDeclaredField("mViews").apply { isAccessible = true }.get(instance) as Iterable<*>
        views.filterIsInstance<View>().joinToString(limit = 12) { root ->
            "${root.javaClass.simpleName}(shown=${root.isShown},attached=${root.isAttachedToWindow}," +
                "focused=${root.hasFocus()},windowFocused=${root.hasWindowFocus()})"
        }
    }.getOrElse { "unavailable:${it.javaClass.simpleName}:${it.message}" }
    return "activity=${activity.javaClass.name} taskId=${activity.taskId} finishing=${activity.isFinishing} " +
        "destroyed=${activity.isDestroyed} decorAttached=${decor.isAttachedToWindow} " +
        "decorShown=${decor.isShown} decorFocused=${decor.hasFocus()} windowFocused=${activity.hasWindowFocus()} " +
        "focusedView=${decor.findFocus()?.javaClass?.name} roots=[$roots] " +
        "windowDump=${shellDump(uiAutomation, "dumpsys window windows")} " +
        "activityDump=${shellDump(uiAutomation, "dumpsys activity activities")}"
}

private fun shellDump(uiAutomation: UiAutomation, command: String): String = runCatching {
    val descriptor = uiAutomation.executeShellCommand(command)
    ParcelFileDescriptor.AutoCloseInputStream(descriptor).bufferedReader().use { reader ->
        val dump = reader.readText()
        val focusLines = dump.lineSequence().filter { line ->
            listOf("mCurrentFocus", "mFocusedApp", "mTopFocusedDisplayId", "mFocusedWindow", "mResumedActivity", "topResumedActivity")
                .any(line::contains)
        }.joinToString("\n")
        (focusLines + "\n" + dump.take(3_000)).take(4_000)
    }
}.getOrElse { "unavailable:${it.javaClass.simpleName}:${it.message}" }
