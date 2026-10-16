package org.trustroots.android.testing

import android.app.Activity
import android.view.KeyEvent
import android.view.View
import androidx.activity.ComponentDialog
import androidx.activity.findViewTreeOnBackPressedDispatcherOwner
import androidx.test.platform.app.InstrumentationRegistry

/**
 * Sends system back to the open dialog or popup.
 *
 * Espresso only delivers back to a window that already has focus. Compose dialogs and
 * dropdowns on current emulator images can stay open without taking focus, and that wait
 * then fails the journey. Dialogs also ignore a synthetic back key and dismiss through
 * their own back dispatcher, so call that when the window belongs to one.
 */
internal fun pressBackFromNonActivityRoot(activity: Activity) {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.waitForIdleSync()
    val target = topNonActivityRoot(activity)
        ?: error("Expected an open dialog or popup to receive system back")
    instrumentation.runOnMainSync {
        val dialog = target.findViewTreeOnBackPressedDispatcherOwner() as? ComponentDialog
        if (dialog != null) {
            dialog.onBackPressedDispatcher.onBackPressed()
        } else {
            target.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK))
            target.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK))
        }
    }
    instrumentation.waitForIdleSync()
}

@Suppress("PrivateApi")
private fun topNonActivityRoot(activity: Activity): View? {
    val manager = Class.forName("android.view.WindowManagerGlobal")
    val instance = manager.getMethod("getInstance").invoke(null)
    val views = manager.getDeclaredField("mViews").apply { isAccessible = true }.get(instance) as Iterable<*>
    val activityDecor = activity.window.decorView
    return views.filterIsInstance<View>().lastOrNull { it.isShown && it !== activityDecor }
}
