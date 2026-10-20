package org.trustroots.android.testing

import android.app.UiAutomation
import android.app.Activity
import android.content.Context
import android.view.inputmethod.InputMethodManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.ui.test.ComposeTimeoutException
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Rect
import android.os.ParcelFileDescriptor
import android.view.View
import android.view.accessibility.AccessibilityWindowInfo
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.lifecycle.LifecycleOwner
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import java.io.ByteArrayOutputStream

/** Reads the system IME window independently of the activity's dispatched window insets. */
internal class KeyboardTestSupport(private val uiAutomation: UiAutomation, private val activity: Activity) : AutoCloseable {
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
        val decor = activity.window.decorView
        val inputMethod = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        try {
            compose.waitUntil(5_000) {
                decor.hasWindowFocus() && decor.findFocus()?.let(inputMethod::isActive) == true
            }
            // A show request made before WindowManager grants input focus can be rejected.
            compose.runOnUiThread {
                WindowInsetsControllerCompat(activity.window, decor).show(WindowInsetsCompat.Type.ime())
            }
            compose.waitUntil(5_000) { imeBoundsOnScreen() != null }
            compose.waitForIdle()
        } catch (error: ComposeTimeoutException) {
            val insets = ViewCompat.getRootWindowInsets(decor)
            val sampledImeBounds = imeBoundsOnScreen()
            throw AssertionError(
                "The focused field must show the IME: windowFocused=${decor.hasWindowFocus()} " +
                    "focusedView=${decor.findFocus()?.javaClass?.name} " +
                    "inputActive=${decor.findFocus()?.let(inputMethod::isActive)} " +
                    "imeVisible=${insets?.isVisible(WindowInsetsCompat.Type.ime())} " +
                    "imeInsets=${insets?.getInsets(WindowInsetsCompat.Type.ime())} " +
                    "imeBounds=$sampledImeBounds $windowDiagnostics\n${activityDiagnostics(decor)}",
                error,
            )
        }
    }

    private fun activityDiagnostics(decor: View): String {
        val focus = decor.findFocus()
        val lifecycle = (activity as? LifecycleOwner)?.lifecycle?.currentState
        val currentActivity = arrayOf("<unavailable>")
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val resumed = ActivityLifecycleMonitorRegistry.getInstance()
                .getActivitiesInStage(Stage.RESUMED).firstOrNull()
            currentActivity[0] = resumed?.let {
                "${it.javaClass.name}(sameAsTestActivity=${it === activity}, " +
                    "lifecycle=${(it as? LifecycleOwner)?.lifecycle?.currentState}, " +
                    "windowFocused=${it.window.decorView.hasWindowFocus()})"
            } ?: "<no resumed activity>"
        }
        val viewState = "activity=${activity.javaClass.name} lifecycle=$lifecycle " +
            "currentResumedActivity=${currentActivity[0]} " +
            "decor=${decor.javaClass.name} attached=${decor.isAttachedToWindow} " +
            "decorSize=${decor.width}x${decor.height} decorVisibility=${decor.windowVisibility} " +
            "decorHasFocus=${decor.hasFocus()} windowFocused=${decor.hasWindowFocus()} " +
            "focusedView=${focus?.javaClass?.name} focusedId=${focus?.let { activity.resources.getResourceNameSafe(it.id) }} " +
            "focusedAttached=${focus?.isAttachedToWindow} " +
            "windowFlags=0x${activity.window.attributes.flags.toString(16)} " +
            "softInputMode=0x${activity.window.attributes.softInputMode.toString(16)} " +
            "decorSystemUi=0x${decor.systemUiVisibility.toString(16)} " +
            "windowType=${activity.window.attributes.type} token=${decor.windowToken != null}"
        val snapshots = listOf(
            "window" to "dumpsys window windows",
            "windowDisplays" to "dumpsys window displays",
            "power" to "dumpsys power",
            "activities" to "dumpsys activity activities",
            "inputMethod" to "dumpsys input_method",
        ).joinToString("\n") { (label, command) -> "$label:\n${shellSnapshot(command)}" }
        return "$viewState\nSystem snapshots (failure only):\n$snapshots"
    }

    private fun shellSnapshot(command: String): String = try {
        val descriptor = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command)
        ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(1024)
            while (output.size() < MAX_SNAPSHOT_SCAN_BYTES) {
                val remaining = (MAX_SNAPSHOT_SCAN_BYTES - output.size()).coerceAtMost(buffer.size)
                val count = input.read(buffer, 0, remaining)
                if (count < 0) break
                output.write(buffer, 0, count)
            }
            val text = output.toString(Charsets.UTF_8.name()).trim()
            filterSnapshot(command, text)
                .takeIf(String::isNotEmpty) ?: "<no output>"
        }
    } catch (error: Exception) {
        "<snapshot failed: ${error.javaClass.simpleName}: ${error.message}>"
    }

    private fun filterSnapshot(command: String, snapshot: String): String {
        val pattern = when {
            command.contains("window") -> Regex("mCurrentFocus|mFocusedApp|mTopFocusedDisplayId|mHoldScreenWindow|mObscuringWindow|mInputMethodWindow|mInputMethodTarget|mInputMethodControlTarget|mAttrs=|mViewVisibility|mHasSurface|mGivenInsets|mTouchableInsets|mPolicyVisibility|mIsImWindow|mOwnerUid|mOwnerPackage|Window #[0-9]+ Window[{]|mDisplayId=|mHasSurface=true")
            command.contains("power") -> Regex("mWakefulness=|mInteractive=|mDisplayPowerRequest=|mUserActivitySummary=|mHoldingDisplaySuspendBlocker=|mHoldingWakeLockSuspendBlocker=")
            command.contains("activity activities") -> Regex("mResumedActivity|topResumedActivity|mFocusedActivity|mTopResumedActivity|ResumedActivity|ACTIVITY.*Resumed")
            else -> Regex("mCurId=|mCurMethodId=|mCurFocusedWindow=|mServedView=|mNextServedView=|mShowRequested=|mInputShown=|mIsInputViewShown=|mImeWindowVis=|mCurToken=|mToken=|mBindState=|mSystemReady=")
        }
        val matchingLines = snapshot.lineSequence().filter(pattern::containsMatchIn).toList()
        val focusLines = matchingLines.filter { line ->
            Regex("mCurrentFocus|mFocusedApp|mTopFocusedDisplayId|mInputMethodTarget|mInputMethodControlTarget|mHoldScreenWindow|mObscuringWindow|mInputMethodWindow|mShowingLockscreen|mKeyguardShowing|mKeyguardOccluded").containsMatchIn(line)
        }
        return (focusLines + matchingLines.filterNot(focusLines::contains))
            .distinct()
            .take(MAX_SNAPSHOT_OUTPUT_LINES)
            .joinToString("\n")
            .take(MAX_SNAPSHOT_OUTPUT_CHARS)
    }

    private fun android.content.res.Resources.getResourceNameSafe(id: Int): String =
        if (id == View.NO_ID) "NO_ID" else runCatching { getResourceName(id) }.getOrDefault(id.toString())

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

private const val MAX_SNAPSHOT_SCAN_BYTES = 256 * 1024
private const val MAX_SNAPSHOT_OUTPUT_LINES = 60
private const val MAX_SNAPSHOT_OUTPUT_CHARS = 12 * 1024
