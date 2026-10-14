package org.trustroots.android.ui

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import android.view.inputmethod.InputMethodManager
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.trustroots.android.ui.theme.TrustrootsTheme

@Composable
internal fun NativeTestAppFrame(
    destination: Destination,
    unreadMessageCount: Int = 0,
    onNavigate: (Destination) -> Unit = {},
    content: @Composable () -> Unit,
) {
    val view = LocalView.current
    SideEffect {
        val activity = view.context as? Activity
        activity?.window?.let { window ->
            window.statusBarColor = Color.WHITE
            window.navigationBarColor = Color.WHITE
            if (Build.VERSION.SDK_INT >= 30) {
                window.decorView.windowInsetsController?.setSystemBarsAppearance(
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                        WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                        WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                )
            } else {
                @Suppress("DEPRECATION")
                run {
                    window.decorView.systemUiVisibility =
                        View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                }
            }
        }
    }
    TrustrootsTheme {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            contentWindowInsets = WindowInsets.safeDrawing,
            bottomBar = {
                MemberNavigationBar(
                    destination = destination,
                    unreadMessageCount = unreadMessageCount,
                    avatarURL = null,
                    sessionCookie = null,
                    memberLabel = "Quiet Fox",
                    onNavigate = onNavigate,
                )
            },
        ) { contentPadding ->
            Box(
                Modifier.fillMaxSize().padding(contentPadding).consumeWindowInsets(contentPadding),
            ) {
                content()
            }
        }
    }
}

/** Capture only anonymous test fixtures, never a member's real session. */
internal fun captureUsabilityScreenshot(compose: ComposeTestRule, name: String) {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val directory = File(context.getExternalFilesDir(null), "usability-screenshots").also { it.mkdirs() }
    compose.waitForIdle()
    awaitCommittedFrame()
    val image = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
    File(directory, "$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
}

internal fun hideTestKeyboard() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
        val activity = ActivityLifecycleMonitorRegistry.getInstance()
            .getActivitiesInStage(Stage.RESUMED)
            .firstOrNull() ?: error("No resumed activity to hide keyboard")
        val inputMethodManager = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        inputMethodManager.hideSoftInputFromWindow(
            activity.currentFocus?.windowToken ?: activity.window.decorView.windowToken,
            0,
        )
        activity.currentFocus?.clearFocus()
    }
}

private fun awaitCommittedFrame() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val activity = arrayOfNulls<Activity>(1)
    instrumentation.runOnMainSync {
        activity[0] = ActivityLifecycleMonitorRegistry.getInstance()
            .getActivitiesInStage(Stage.RESUMED)
            .firstOrNull()
    }
    val decorView = requireNotNull(activity[0]) { "No resumed activity to capture" }.window.decorView
    val frameCommitted = CountDownLatch(1)
    instrumentation.runOnMainSync {
        if (Build.VERSION.SDK_INT >= 29) {
            decorView.viewTreeObserver.registerFrameCommitCallback { frameCommitted.countDown() }
            decorView.invalidate()
        } else {
            decorView.postOnAnimation { frameCommitted.countDown() }
            decorView.invalidate()
        }
    }
    check(frameCommitted.await(10, TimeUnit.SECONDS)) { "Timed out waiting for screenshot frame" }
}
