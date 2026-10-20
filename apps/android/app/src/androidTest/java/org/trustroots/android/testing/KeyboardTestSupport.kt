package org.trustroots.android.testing

import android.app.UiAutomation
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Rect
import android.view.accessibility.AccessibilityWindowInfo

/** Reads the system IME window independently of the activity's dispatched window insets. */
internal class KeyboardTestSupport(private val uiAutomation: UiAutomation) : AutoCloseable {
    private val originallyRetrievedInteractiveWindows =
        uiAutomation.serviceInfo.flags and AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS != 0

    init {
        val serviceInfo = uiAutomation.serviceInfo
        serviceInfo.flags = serviceInfo.flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        uiAutomation.serviceInfo = serviceInfo
    }

    fun imeBoundsOnScreen(): Rect? = uiAutomation.windows
        .firstOrNull { it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD }
        ?.let { Rect().also(it::getBoundsInScreen) }
        ?.takeUnless { it.isEmpty() }

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
