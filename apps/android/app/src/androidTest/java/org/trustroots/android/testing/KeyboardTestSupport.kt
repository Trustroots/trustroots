package org.trustroots.android.testing

import android.app.UiAutomation
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Rect
import android.view.accessibility.AccessibilityWindowInfo
import androidx.compose.ui.test.junit4.ComposeTestRule

/** Reads the system IME window independently of the activity's dispatched window insets. */
internal class KeyboardTestSupport(private val uiAutomation: UiAutomation) : AutoCloseable {
    private val originallyRetrievedInteractiveWindows =
        uiAutomation.serviceInfo.flags and AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS != 0

    init {
        val serviceInfo = uiAutomation.serviceInfo
        serviceInfo.flags = serviceInfo.flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        uiAutomation.serviceInfo = serviceInfo
    }

    var windowDiagnostics: String = "No accessibility windows sampled"
        private set

    fun awaitShown(compose: ComposeTestRule) {
        compose.waitUntil(5_000) { imeBoundsOnScreen() != null }
        compose.waitForIdle()
    }

    fun imeBoundsOnScreen(): Rect? {
        val serviceInfo = uiAutomation.serviceInfo
        val previousFlags = serviceInfo.flags
        if (previousFlags and AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS == 0) {
            serviceInfo.flags = previousFlags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            uiAutomation.serviceInfo = serviceInfo
        }
        val windows = uiAutomation.windows
        windowDiagnostics = "flagsBefore=$previousFlags flagsNow=${uiAutomation.serviceInfo.flags} windows=" +
            windows.joinToString { window ->
                val bounds = Rect().also(window::getBoundsInScreen)
                "type=${window.type} bounds=$bounds focused=${window.isFocused}"
            }
        return windows.firstOrNull { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD }
            ?.let { Rect().also(it::getBoundsInScreen) }
            ?.takeUnless { it.isEmpty() }
    }

    override fun close() {
        val serviceInfo = uiAutomation.serviceInfo
        serviceInfo.flags = if (originallyRetrievedInteractiveWindows) {
            serviceInfo.flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        } else {
            serviceInfo.flags and AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS.inv()
        }
        uiAutomation.serviceInfo = serviceInfo
    }
}
