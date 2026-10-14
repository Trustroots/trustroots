package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File

/** Capture only anonymous test fixtures, never a member's real session. */
internal fun captureUsabilityScreenshot(compose: ComposeTestRule, name: String) {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val directory = File(context.getExternalFilesDir(null), "usability-screenshots").also { it.mkdirs() }
    compose.waitForIdle()
    val image = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
    File(directory, "$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
}
