package org.trustroots.android.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Test

class ProfileImageGeometryTest {
    @Test
    fun `small decoded image is never enlarged`() {
        assertEquals(
            1f,
            ProfileImageGeometry.initialScale(
                imageWidthPx = 320,
                imageHeightPx = 240,
                viewportWidthPx = 1080,
                viewportHeightPx = 1920,
            ),
            0f,
        )
    }

    @Test
    fun `large image fits by its limiting dimension`() {
        assertEquals(
            0.5f,
            ProfileImageGeometry.initialScale(
                imageWidthPx = 2400,
                imageHeightPx = 1200,
                viewportWidthPx = 1200,
                viewportHeightPx = 800,
            ),
            0.0001f,
        )
    }

    @Test
    fun `scale is clamped between initial fit and one source pixel per display pixel`() {
        val belowFit = ProfileImageGeometry.clamp(
            ProfileImageTransform(scale = 0.1f), 2400, 1200, 1200, 800,
        )
        val aboveNativePixels = ProfileImageGeometry.clamp(
            ProfileImageTransform(scale = 3f), 2400, 1200, 1200, 800,
        )

        assertEquals(0.5f, belowFit.scale, 0.0001f)
        assertEquals(1f, aboveNativePixels.scale, 0f)
    }

    @Test
    fun `pan is clamped to image edges`() {
        val transform = ProfileImageGeometry.clamp(
            ProfileImageTransform(scale = 1f, translationX = 900f, translationY = -900f),
            imageWidthPx = 2400,
            imageHeightPx = 1200,
            viewportWidthPx = 1200,
            viewportHeightPx = 800,
        )

        assertEquals(600f, transform.translationX, 0f)
        assertEquals(-200f, transform.translationY, 0f)
    }

    @Test
    fun `zooming around a focal point stays within image bounds`() {
        val zoomed = ProfileImageGeometry.zoomAround(
            current = ProfileImageTransform(scale = 0.5f),
            requestedScale = 1f,
            focalX = 900f,
            focalY = 400f,
            imageWidthPx = 2400,
            imageHeightPx = 1200,
            viewportWidthPx = 1200,
            viewportHeightPx = 800,
        )

        assertEquals(1f, zoomed.scale, 0f)
        assertEquals(-300f, zoomed.translationX, 0.001f)
        assertEquals(0f, zoomed.translationY, 0f)
    }

    @Test
    fun `viewport growth raises fit scale and clamps old pan`() {
        val resized = ProfileImageGeometry.clamp(
            ProfileImageTransform(scale = 0.5f, translationX = 500f, translationY = 350f),
            imageWidthPx = 2400,
            imageHeightPx = 1600,
            viewportWidthPx = 1600,
            viewportHeightPx = 900,
        )

        assertEquals(0.5625f, resized.scale, 0.0001f)
        assertEquals(0f, resized.translationX, 0f)
        assertEquals(0f, resized.translationY, 0f)

        val zoomedAfterResize = ProfileImageGeometry.clamp(
            ProfileImageTransform(scale = 1f, translationX = 700f, translationY = 500f),
            imageWidthPx = 2400,
            imageHeightPx = 1600,
            viewportWidthPx = 1600,
            viewportHeightPx = 900,
        )
        assertEquals(400f, zoomedAfterResize.translationX, 0f)
        assertEquals(350f, zoomedAfterResize.translationY, 0f)
    }
}
