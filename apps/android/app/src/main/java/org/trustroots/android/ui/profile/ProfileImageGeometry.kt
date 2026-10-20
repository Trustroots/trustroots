package org.trustroots.android.ui.profile

import kotlin.math.min

/** The image is positioned by its centre-relative translation in physical pixels. */
internal data class ProfileImageTransform(
    val scale: Float,
    val translationX: Float = 0f,
    val translationY: Float = 0f,
)

/**
 * Calculates fit and pan limits using decoded bitmap pixels and physical
 * display pixels. At scale 1, one bitmap pixel occupies one display pixel.
 */
internal object ProfileImageGeometry {
    fun initialScale(
        imageWidthPx: Int,
        imageHeightPx: Int,
        viewportWidthPx: Int,
        viewportHeightPx: Int,
    ): Float {
        require(imageWidthPx > 0 && imageHeightPx > 0)
        require(viewportWidthPx > 0 && viewportHeightPx > 0)
        return min(
            1f,
            min(
                viewportWidthPx.toFloat() / imageWidthPx,
                viewportHeightPx.toFloat() / imageHeightPx,
            ),
        )
    }

    fun clamp(
        transform: ProfileImageTransform,
        imageWidthPx: Int,
        imageHeightPx: Int,
        viewportWidthPx: Int,
        viewportHeightPx: Int,
    ): ProfileImageTransform {
        val minScale = initialScale(imageWidthPx, imageHeightPx, viewportWidthPx, viewportHeightPx)
        val scale = transform.scale.coerceIn(minScale, 1f)
        val maxTranslationX = ((imageWidthPx * scale - viewportWidthPx) / 2f).coerceAtLeast(0f)
        val maxTranslationY = ((imageHeightPx * scale - viewportHeightPx) / 2f).coerceAtLeast(0f)
        return ProfileImageTransform(
            scale = scale,
            translationX = transform.translationX.coerceIn(-maxTranslationX, maxTranslationX),
            translationY = transform.translationY.coerceIn(-maxTranslationY, maxTranslationY),
        )
    }

    fun zoomAround(
        current: ProfileImageTransform,
        requestedScale: Float,
        focalX: Float,
        focalY: Float,
        imageWidthPx: Int,
        imageHeightPx: Int,
        viewportWidthPx: Int,
        viewportHeightPx: Int,
    ): ProfileImageTransform {
        val minScale = initialScale(imageWidthPx, imageHeightPx, viewportWidthPx, viewportHeightPx)
        val newScale = requestedScale.coerceIn(minScale, 1f)
        val imageX = (focalX - viewportWidthPx / 2f - current.translationX) / current.scale
        val imageY = (focalY - viewportHeightPx / 2f - current.translationY) / current.scale
        return clamp(
            ProfileImageTransform(
                scale = newScale,
                translationX = focalX - viewportWidthPx / 2f - imageX * newScale,
                translationY = focalY - viewportHeightPx / 2f - imageY * newScale,
            ),
            imageWidthPx,
            imageHeightPx,
            viewportWidthPx,
            viewportHeightPx,
        )
    }
}
