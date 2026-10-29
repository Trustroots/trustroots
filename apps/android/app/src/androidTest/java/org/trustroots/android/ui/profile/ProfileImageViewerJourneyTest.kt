package org.trustroots.android.ui.profile

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.captureUsabilityScreenshot
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ProfileImageViewerJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private fun activateImageAction(image: SemanticsNodeInteraction, label: String) {
        val action = image.fetchSemanticsNode().config[SemanticsActions.CustomActions]
            .single { it.label == label }
        compose.runOnIdle { assertTrue(action.action()) }
        compose.waitForIdle()
    }

    @Test fun compactProfileAvatarKeepsItsTouchTargetAndIdentityRowFits() {
        var avatarClicked = false
        compose.setContent {
            TrustrootsTheme {
                ArtworkHero(
                    url = null,
                    sessionCookie = null,
                    label = "Sample member",
                    subtitle = "@sample-member",
                    background = Color.White,
                    blurBackground = false,
                    testTag = "compactProfileHero",
                    heroHeight = 100.dp,
                    compact = true,
                    onProfileImageClick = { avatarClicked = true },
                )
            }
        }

        val avatarBounds = compose.onNodeWithTag("profileAvatar").fetchSemanticsNode().boundsInRoot
        val identityBounds = compose.onNodeWithTag("compactProfileHero-identity").fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertTrue("Compact avatar touch width should be at least 48dp", avatarBounds.width.toDp() >= 48.dp)
            assertTrue("Compact avatar touch height should be at least 48dp", avatarBounds.height.toDp() >= 48.dp)
            assertTrue("Compact identity row should remain within its 52dp budget", identityBounds.height.toDp() <= 52.dp)
        }
        compose.onNodeWithTag("profileAvatar").performClick()
        assertTrue("Tapping the avatar should open the profile photo", avatarClicked)
    }

    @Test fun closeReturnsToTheSameProfileSection() {
        val showingPhoto = mutableStateOf(false)
        val bitmap = Bitmap.createBitmap(240, 160, Bitmap.Config.ARGB_8888)
        val originalActivityWindow = activityWindowState()
        compose.setContent {
            MaterialTheme {
                Column {
                    Text("About", modifier = androidx.compose.ui.Modifier.testTag("profileSection"))
                    Button(onClick = { showingPhoto.value = true }) { Text("Open profile photo") }
                    if (showingPhoto.value) {
                        ProfileImageViewer(
                            bitmap = bitmap,
                            isLoading = false,
                            memberLabel = "Sample member",
                            onClose = { showingPhoto.value = false },
                        )
                    }
                }
            }
        }

        compose.onNodeWithText("Open profile photo").performClick()
        compose.onNodeWithTag("profileImageViewer").assertIsDisplayed()
        compose.onNodeWithTag("profileImageViewer").assert(
            SemanticsMatcher.expectValue(
                ProfileImageWindowBarsKey,
                ProfileImageWindowBars(lightStatusBars = false, lightNavigationBars = false),
            ),
        )
        compose.onNodeWithContentDescription("Profile photo of Sample member").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_profile_image_viewer")
        val screen = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        try {
            assertEquals("Status-bar background should be black", AndroidColor.BLACK, screen.getPixel(screen.width / 3, 10))
            assertEquals("Navigation-bar background should be black", AndroidColor.BLACK, screen.getPixel(screen.width / 3, screen.height - 10))
            assertEquals("Top-left system-bar background should be black", AndroidColor.BLACK, screen.getPixel(0, 0))
            assertEquals("Top-right system-bar background should be black", AndroidColor.BLACK, screen.getPixel(screen.width - 1, 0))
            assertEquals("Bottom-left system-bar background should be black", AndroidColor.BLACK, screen.getPixel(0, screen.height - 1))
            assertEquals("Bottom-right system-bar background should be black", AndroidColor.BLACK, screen.getPixel(screen.width - 1, screen.height - 1))
        } finally {
            screen.recycle()
        }
        compose.onNodeWithContentDescription("Close profile photo").performClick()
        compose.onNodeWithTag("profileSection").assertIsDisplayed()
        compose.onNodeWithText("Open profile photo").assertIsDisplayed()
        assertEquals(originalActivityWindow, activityWindowState())
    }

    @Test fun failedPhotoKeepsAnAccessibleCloseControl() {
        val showingPhoto = mutableStateOf(true)
        compose.setContent {
            MaterialTheme {
                if (showingPhoto.value) {
                    ProfileImageViewer(
                        bitmap = null,
                        isLoading = false,
                        memberLabel = "Sample member",
                        onClose = { showingPhoto.value = false },
                    )
                }
            }
        }

        compose.onNodeWithText("Could not load profile photo.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close profile photo").assertIsDisplayed().performClick()
        compose.waitUntil(2_000) { compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isEmpty() }
    }

    @Test fun systemBackClosesViewerAndRestoresProfileSection() {
        val showingPhoto = mutableStateOf(true)
        val bitmap = Bitmap.createBitmap(240, 160, Bitmap.Config.ARGB_8888)
        compose.setContent {
            MaterialTheme {
                Column {
                    Text("Contacts", modifier = androidx.compose.ui.Modifier.testTag("profileSection"))
                    if (showingPhoto.value) {
                        ProfileImageViewer(
                            bitmap = bitmap,
                            isLoading = false,
                            memberLabel = "Sample member",
                            onClose = { showingPhoto.value = false },
                        )
                    }
                }
            }
        }

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }

        compose.waitUntil(2_000) { compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithTag("profileSection").assertIsDisplayed()
    }

    @Test fun loadingPhotoKeepsAnAccessibleCloseControl() {
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = null,
                    isLoading = true,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }

        compose.onNodeWithText("Loading profile photo…").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close profile photo").assertIsDisplayed()
    }

    @Test fun viewerControlsKeepReadableContrastOverBrightProfilePhotos() {
        val bitmap = Bitmap.createBitmap(720, 1_600, Bitmap.Config.ARGB_8888).apply {
            eraseColor(AndroidColor.WHITE)
        }
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }

        val controlPixels = compose.onNodeWithTag("profileImageControls").captureToImage().toPixelMap()
        val backplatePixel = controlPixels[controlPixels.width / 2, 1]
        val whiteContrast = 1.05f / (backplatePixel.luminance() + 0.05f)
        assertTrue(
            "Viewer control backplate should provide 4.5:1 contrast against white photos; got $whiteContrast:1",
            whiteContrast >= 4.5f,
        )
    }

    @Test fun accessibleZoomAndResetStayWithinNativePixelScale() {
        val bitmap = Bitmap.createBitmap(2_000, 1_500, Bitmap.Config.ARGB_8888)
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }

        val image = compose.onNodeWithContentDescription("Profile photo of Sample member")
        compose.onNodeWithContentDescription("Zoom in").assertDoesNotExist()
        compose.onNodeWithContentDescription("Zoom out").assertDoesNotExist()
        compose.onNodeWithContentDescription("Reset profile photo zoom").assertDoesNotExist()
        compose.waitUntil(2_000) { imageViewport(image) != IntSize.Zero }
        val viewport = imageViewport(image)
        val expectedFitScale = minOf(
            1f,
            viewport.width.toFloat() / bitmap.width,
            viewport.height.toFloat() / bitmap.height,
        )
        assertEquals(expectedFitScale, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)
        repeat(12) { activateImageAction(image, "Zoom in") }
        image.assert(SemanticsMatcher.expectValue(ProfileImageScaleKey, 1f))
        activateImageAction(image, "Reset")
        image.assert(SemanticsMatcher.expectValue(ProfileImageScaleKey, expectedFitScale))
        activateImageAction(image, "Zoom in")
        activateImageAction(image, "Zoom out")
        image.assert(SemanticsMatcher.expectValue(ProfileImageScaleKey, expectedFitScale))
    }

    @Test fun screenReaderActionsZoomAndResetThePhoto() {
        val bitmap = Bitmap.createBitmap(2_000, 1_500, Bitmap.Config.ARGB_8888)
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }

        val image = compose.onNodeWithContentDescription("Profile photo of Sample member")
        compose.waitUntil(2_000) { imageViewport(image) != IntSize.Zero }
        val fitScale = image.fetchSemanticsNode().config[ProfileImageScaleKey]
        assertTrue("The fixture must have room to zoom in", fitScale < 1f)

        fun activate(label: String) {
            val action = image.fetchSemanticsNode().config[SemanticsActions.CustomActions]
                .single { it.label == label }
            compose.runOnIdle { assertTrue(action.action()) }
            compose.waitForIdle()
        }

        activate("Zoom in")
        val zoomedScale = image.fetchSemanticsNode().config[ProfileImageScaleKey]
        assertTrue(zoomedScale > fitScale && zoomedScale <= 1f)
        activate("Zoom out")
        assertEquals(fitScale, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)
        activate("Zoom in")
        activate("Reset")
        assertEquals(fitScale, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)
        assertEquals(0f to 0f, imageTranslation(image))
    }

    @Test fun pinchAndPanGesturesUpdateTheBoundedImageTransform() {
        val bitmap = Bitmap.createBitmap(2_000, 1_500, Bitmap.Config.ARGB_8888)
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }

        val image = compose.onNodeWithContentDescription("Profile photo of Sample member")
        val initialScale = image.fetchSemanticsNode().config[ProfileImageScaleKey]
        image.performTouchInput {
            val center = this.center
            down(0, center - Offset(80f, 0f))
            down(1, center + Offset(80f, 0f))
            moveTo(0, center - Offset(150f, 0f))
            moveTo(1, center + Offset(150f, 0f))
            up(0)
            up(1)
        }
        compose.waitUntil(2_000) { image.fetchSemanticsNode().config[ProfileImageScaleKey] > initialScale }
        assertTrue(image.fetchSemanticsNode().config[ProfileImageScaleKey] <= 1f)

        val beforePan = image.fetchSemanticsNode().config[ProfileImageTranslationKey]
        image.performTouchInput {
            val center = this.center
            down(0, center)
            moveTo(0, center + Offset(120f, 90f))
            up(0)
        }
        compose.waitUntil(2_000) { image.fetchSemanticsNode().config[ProfileImageTranslationKey] != beforePan }
    }

    @Test fun smallerThanViewportPhotoKeepsOneToOneInitialScale() {
        val bitmap = Bitmap.createBitmap(12, 8, Bitmap.Config.ARGB_8888)
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }
        compose.onNodeWithContentDescription("Profile photo of Sample member")
            .assert(SemanticsMatcher.expectValue(ProfileImageScaleKey, 1f))
    }

    @Test fun resizingViewerViewportClampsExistingZoomAndPan() {
        val bitmap = Bitmap.createBitmap(2_400, 1_800, Bitmap.Config.ARGB_8888)
        val viewportDp = mutableStateOf(IntSize(160, 320))
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                    modifier = Modifier.size(viewportDp.value.width.dp, viewportDp.value.height.dp),
                )
            }
        }

        val image = compose.onNodeWithContentDescription("Profile photo of Sample member")
        compose.waitUntil(2_000) { imageViewport(image) != IntSize.Zero }
        repeat(12) { activateImageAction(image, "Zoom in") }
        compose.waitUntil(2_000) { image.fetchSemanticsNode().config[ProfileImageScaleKey] == 1f }
        repeat(8) {
            image.performTouchInput {
                val center = this.center
                down(0, center)
                moveTo(0, center + Offset(400f, 0f))
                up(0)
            }
        }
        val oldViewport = imageViewport(image)
        val oldScale = image.fetchSemanticsNode().config[ProfileImageScaleKey]
        val oldTranslationX = imageTranslation(image).first
        val oldMaximumPanX = ((bitmap.width * oldScale - oldViewport.width) / 2f).coerceAtLeast(0f)
        assertTrue(oldTranslationX > 0f)

        viewportDp.value = IntSize(240, 160)
        compose.waitUntil(2_000) {
            val resized = imageViewport(image)
            resized.width != oldViewport.width && resized.height != oldViewport.height
        }
        val resizedViewport = imageViewport(image)
        val resizedScale = image.fetchSemanticsNode().config[ProfileImageScaleKey]
        val resizedTranslationX = imageTranslation(image).first
        val resizedMaximumPanX = ((bitmap.width * resizedScale - resizedViewport.width) / 2f).coerceAtLeast(0f)
        assertTrue(resizedMaximumPanX < oldMaximumPanX)
        assertTrue(kotlin.math.abs(resizedTranslationX) <= resizedMaximumPanX + 1f)

        repeat(12) { activateImageAction(image, "Zoom out") }
        val fitBeforeGrowth = image.fetchSemanticsNode().config[ProfileImageScaleKey]
        viewportDp.value = IntSize(320, 480)
        compose.waitUntil(2_000) {
            val viewport = imageViewport(image)
            viewport.width > resizedViewport.width && viewport.height > resizedViewport.height &&
                image.fetchSemanticsNode().config[ProfileImageScaleKey] > fitBeforeGrowth
        }
        val grownViewport = imageViewport(image)
        val grownFit = ProfileImageGeometry.initialScale(
            bitmap.width,
            bitmap.height,
            grownViewport.width,
            grownViewport.height,
        )
        assertEquals(grownFit, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)
    }

    @Test fun replacingBitmapWhileViewerIsOpenResetsZoomForTheNewPhoto() {
        val bitmap = mutableStateOf(Bitmap.createBitmap(2_000, 1_500, Bitmap.Config.ARGB_8888))
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap.value,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                )
            }
        }

        val image = compose.onNodeWithContentDescription("Profile photo of Sample member")
        compose.waitUntil(2_000) { imageViewport(image) != IntSize.Zero }
        repeat(12) { activateImageAction(image, "Zoom in") }
        assertEquals(1f, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)

        val replacement = Bitmap.createBitmap(3_200, 2_000, Bitmap.Config.ARGB_8888)
        val viewport = imageViewport(image)
        val replacementFit = minOf(
            1f,
            viewport.width.toFloat() / replacement.width,
            viewport.height.toFloat() / replacement.height,
        )
        bitmap.value = replacement

        compose.waitUntil(2_000) {
            image.fetchSemanticsNode().config[ProfileImageScaleKey] == replacementFit &&
                imageTranslation(image) == (0f to 0f)
        }
        assertEquals(replacementFit, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)
    }

    @Test fun zeroHeightViewportKeepsZoomUnavailableUntilBothDimensionsArePositive() {
        val bitmap = Bitmap.createBitmap(2_000, 1_500, Bitmap.Config.ARGB_8888)
        val viewportHeight = mutableStateOf(0.dp)
        compose.setContent {
            MaterialTheme {
                ProfileImageViewer(
                    bitmap = bitmap,
                    isLoading = false,
                    memberLabel = "Sample member",
                    onClose = {},
                    modifier = Modifier.size(320.dp, viewportHeight.value),
                )
            }
        }

        val image = compose.onNodeWithContentDescription("Profile photo of Sample member")
        compose.waitUntil(2_000) { imageViewport(image).width > 0 }
        assertEquals(0, imageViewport(image).height)
        assertTrue(
            "Zoom accessibility actions should not be offered before the viewport is usable",
            image.fetchSemanticsNode().config[SemanticsActions.CustomActions].isEmpty(),
        )
        compose.onNodeWithContentDescription("Zoom in").assertDoesNotExist()
        compose.onNodeWithContentDescription("Zoom out").assertDoesNotExist()
        compose.onNodeWithContentDescription("Reset profile photo zoom").assertDoesNotExist()

        viewportHeight.value = 320.dp
        compose.waitUntil(2_000) {
            val viewport = imageViewport(image)
            viewport.width > 0 && viewport.height > 0
        }
        val viewport = imageViewport(image)
        val expectedFit = ProfileImageGeometry.initialScale(bitmap.width, bitmap.height, viewport.width, viewport.height)
        assertEquals(expectedFit, image.fetchSemanticsNode().config[ProfileImageScaleKey], 0.001f)
        compose.onNodeWithContentDescription("Zoom in").assertDoesNotExist()
        assertEquals(3, image.fetchSemanticsNode().config[SemanticsActions.CustomActions].size)
    }

    private fun imageViewport(image: SemanticsNodeInteraction): IntSize =
        image.fetchSemanticsNode().config[ProfileImageViewportKey].split(',').let { parts ->
            IntSize(parts[0].toInt(), parts[1].toInt())
        }

    private fun imageTranslation(image: SemanticsNodeInteraction): Pair<Float, Float> =
        image.fetchSemanticsNode().config[ProfileImageTranslationKey].split(',').let { parts ->
            parts[0].toFloat() to parts[1].toFloat()
        }

    private fun activityWindowState(): ActivityWindowState {
        lateinit var state: ActivityWindowState
        compose.runOnUiThread {
            val window = compose.activity.window
            state = ActivityWindowState(
                statusBarColor = window.statusBarColor,
                navigationBarColor = window.navigationBarColor,
                systemUiVisibility = window.decorView.systemUiVisibility,
            )
        }
        return state
    }

    private data class ActivityWindowState(
        val statusBarColor: Int,
        val navigationBarColor: Int,
        val systemUiVisibility: Int,
    )
}
