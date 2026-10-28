package org.trustroots.android.ui.profile

import android.graphics.Bitmap
import android.view.Window
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material.icons.filled.ZoomOut
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlin.math.roundToInt
import org.trustroots.android.R

internal val ProfileImageWindowBarsKey = SemanticsPropertyKey<String>("ProfileImageWindowBars")
internal val ProfileImageScaleKey = SemanticsPropertyKey<Float>("ProfileImageScale")
internal val ProfileImageTranslationKey = SemanticsPropertyKey<String>("ProfileImageTranslation")
internal val ProfileImageViewportKey = SemanticsPropertyKey<String>("ProfileImageViewport")

@Composable
internal fun ProfileImageViewer(
    bitmap: Bitmap?,
    isLoading: Boolean,
    memberLabel: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var viewport by remember { mutableStateOf(IntSize.Zero) }
    var transform by remember(bitmap) { mutableStateOf<ProfileImageTransform?>(null) }
    val imageSize = bitmap?.let { IntSize(it.width, it.height) } ?: IntSize.Zero
    val fitScale = if (imageSize != IntSize.Zero && viewport != IntSize.Zero) {
        ProfileImageGeometry.initialScale(imageSize.width, imageSize.height, viewport.width, viewport.height)
    } else {
        1f
    }
    val currentTransform = if (imageSize != IntSize.Zero && viewport != IntSize.Zero) {
        ProfileImageGeometry.clampOrFit(
            transform,
            imageSize.width,
            imageSize.height,
            viewport.width,
            viewport.height,
        )
    } else {
        ProfileImageTransform(scale = fitScale)
    }
    val viewerBackground = colorResource(R.color.profile_image_viewer_background)
    val viewerContent = colorResource(R.color.profile_image_viewer_content)
    LaunchedEffect(bitmap, viewport) {
        if (bitmap != null && viewport != IntSize.Zero && transform != null) {
            transform = ProfileImageGeometry.clamp(
                requireNotNull(transform),
                imageSize.width,
                imageSize.height,
                viewport.width,
                viewport.height,
            )
        }
    }
    fun zoomTo(requestedScale: Float) {
        if (imageSize == IntSize.Zero || viewport == IntSize.Zero) return
        val current = ProfileImageGeometry.clampOrFit(
            transform,
            imageSize.width,
            imageSize.height,
            viewport.width,
            viewport.height,
        )
        transform = ProfileImageGeometry.zoomAround(
            current = current,
            requestedScale = requestedScale,
            focalX = viewport.width / 2f,
            focalY = viewport.height / 2f,
            imageWidthPx = imageSize.width,
            imageHeightPx = imageSize.height,
            viewportWidthPx = viewport.width,
            viewportHeightPx = viewport.height,
        )
    }

    BackHandler(onBack = onClose)
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        val windowBars = rememberProfileImageWindowStyle()
        Box(
            modifier
                .fillMaxSize()
                .background(viewerBackground)
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .semantics { this[ProfileImageWindowBarsKey] = windowBars }
                .testTag("profileImageViewer"),
        ) {
            if (bitmap != null) {
                val imageBitmap = remember(bitmap) { bitmap.asImageBitmap() }
                val imageDescription = stringResource(R.string.profile_photo_description, memberLabel)
                val accessibilityActions = listOf(
                    CustomAccessibilityAction(stringResource(R.string.profile_photo_zoom_in)) {
                        zoomTo(currentTransform.scale * 1.5f)
                        true
                    },
                    CustomAccessibilityAction(stringResource(R.string.profile_photo_zoom_out)) {
                        zoomTo(currentTransform.scale / 1.5f)
                        true
                    },
                    CustomAccessibilityAction(stringResource(R.string.profile_photo_zoom_reset_short)) {
                        transform = null
                        true
                    },
                )
                Canvas(
                    Modifier
                        .fillMaxSize()
                        .clipToBounds()
                        .onSizeChanged { viewport = it }
                        .testTag("profileImageCanvas")
                        .semantics {
                            role = Role.Image
                            contentDescription = imageDescription
                            this[ProfileImageScaleKey] = currentTransform.scale
                            this[ProfileImageTranslationKey] = "${currentTransform.translationX},${currentTransform.translationY}"
                            this[ProfileImageViewportKey] = "${viewport.width},${viewport.height}"
                            customActions = accessibilityActions
                        }
                        .pointerInput(bitmap, viewport, fitScale) {
                            detectTransformGestures { centroid, pan, zoom, _ ->
                                if (viewport == IntSize.Zero) return@detectTransformGestures
                                val current = ProfileImageGeometry.clampOrFit(
                                    transform,
                                    imageSize.width,
                                    imageSize.height,
                                    viewport.width,
                                    viewport.height,
                                )
                                val zoomed = ProfileImageGeometry.zoomAround(
                                    current = current,
                                    requestedScale = current.scale * zoom,
                                    focalX = centroid.x,
                                    focalY = centroid.y,
                                    imageWidthPx = imageSize.width,
                                    imageHeightPx = imageSize.height,
                                    viewportWidthPx = viewport.width,
                                    viewportHeightPx = viewport.height,
                                )
                                transform = ProfileImageGeometry.clamp(
                                    zoomed.copy(
                                        translationX = zoomed.translationX + pan.x,
                                        translationY = zoomed.translationY + pan.y,
                                    ),
                                    imageSize.width,
                                    imageSize.height,
                                    viewport.width,
                                    viewport.height,
                                )
                            }
                        },
                ) {
                    if (viewport != IntSize.Zero) {
                        val active = currentTransform
                        val imageWidth = (imageSize.width * active.scale).roundToInt()
                        val imageHeight = (imageSize.height * active.scale).roundToInt()
                        val left = ((size.width - imageWidth) / 2f + active.translationX).roundToInt()
                        val top = ((size.height - imageHeight) / 2f + active.translationY).roundToInt()
                        drawImage(
                            image = imageBitmap,
                            dstOffset = androidx.compose.ui.unit.IntOffset(left, top),
                            dstSize = IntSize(imageWidth, imageHeight),
                        )
                    }
                }
            } else {
                Column(
                    Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = viewerContent)
                        Text(stringResource(R.string.profile_photo_loading), color = viewerContent)
                    } else {
                        Text(
                            stringResource(R.string.profile_photo_load_error),
                            color = viewerContent,
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
            }

            Row(
                Modifier.align(Alignment.TopEnd).padding(4.dp)
                    .background(colorResource(R.color.profile_image_viewer_controls_background), RoundedCornerShape(28.dp))
                    .testTag("profileImageControls")
                    .padding(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (bitmap != null) {
                    val resetDescription = stringResource(R.string.profile_photo_zoom_reset)
                    Text(
                        stringResource(R.string.profile_photo_zoom_reset_short),
                        color = viewerContent,
                        modifier = Modifier
                            .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                            .semantics { contentDescription = resetDescription }
                            .clickable { transform = null }
                            .wrapContentSize(Alignment.Center),
                    )
                    IconButton(
                        onClick = { zoomTo(currentTransform.scale / 1.5f) },
                        modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
                    ) {
                        Icon(Icons.Default.ZoomOut, contentDescription = stringResource(R.string.profile_photo_zoom_out), tint = viewerContent)
                    }
                    IconButton(
                        onClick = { zoomTo(currentTransform.scale * 1.5f) },
                        modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
                    ) {
                        Icon(Icons.Default.ZoomIn, contentDescription = stringResource(R.string.profile_photo_zoom_in), tint = viewerContent)
                    }
                }
                IconButton(
                    onClick = onClose,
                    modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).testTag("closeProfileImage"),
                ) {
                    Icon(Icons.Default.Close, contentDescription = stringResource(R.string.close_profile_photo), tint = viewerContent)
                }
            }
        }
    }
}

@Composable
private fun rememberProfileImageWindowStyle(): String {
    val dialogWindow = (LocalView.current.parent as? DialogWindowProvider)?.window
    var windowBars by remember(dialogWindow) { mutableStateOf("") }
    DisposableEffect(dialogWindow) {
        if (dialogWindow == null) return@DisposableEffect onDispose {}
        val decorView = dialogWindow.decorView
        val insetsController = WindowCompat.getInsetsController(dialogWindow, decorView)
        val originalLightStatusBars = insetsController.isAppearanceLightStatusBars
        val originalLightNavigationBars = insetsController.isAppearanceLightNavigationBars
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false
        windowBars = describeWindowBars(dialogWindow)
        onDispose {
            insetsController.isAppearanceLightStatusBars = originalLightStatusBars
            insetsController.isAppearanceLightNavigationBars = originalLightNavigationBars
        }
    }
    return windowBars
}

private fun describeWindowBars(window: Window): String {
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    return "statusWhiteIcons=${!controller.isAppearanceLightStatusBars};" +
        "navigationWhiteIcons=${!controller.isAppearanceLightNavigationBars}"
}
