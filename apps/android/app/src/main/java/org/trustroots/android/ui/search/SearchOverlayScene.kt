package org.trustroots.android.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.input.pointer.pointerInput
import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.colorResource
import org.trustroots.android.R
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.NavMetadataKey
import androidx.navigation3.runtime.get
import androidx.navigation3.runtime.metadata as navMetadata
import androidx.navigation3.scene.OverlayScene
import androidx.navigation3.scene.Scene
import androidx.navigation3.scene.SceneStrategy
import androidx.navigation3.scene.SceneStrategyScope

internal enum class SearchOverlayKind { HostDetail, Profile }

/** Keeps Search overlays in the activity window and the shell's scaffold. */
internal object SearchOverlaySceneStrategy : SceneStrategy<NavKey> {
    private val overlayKindKey = object : NavMetadataKey<SearchOverlayKind> {}

    fun metadata(kind: SearchOverlayKind): Map<String, Any> = navMetadata {
        put(overlayKindKey, kind)
    }

    override fun SceneStrategyScope<NavKey>.calculateScene(
        entries: List<NavEntry<NavKey>>,
    ): Scene<NavKey>? {
        val overlayEntry = entries.lastOrNull() ?: return null
        val kind = overlayEntry.metadata.get(overlayKindKey) ?: return null
        return SearchOverlayScene(
            entry = overlayEntry,
            overlaidEntries = entries.dropLast(1),
            kind = kind,
            onBack = onBack,
        )
    }
}

private class SearchOverlayScene(
    private val entry: NavEntry<NavKey>,
    override val overlaidEntries: List<NavEntry<NavKey>>,
    private val kind: SearchOverlayKind,
    private val onBack: () -> Unit,
) : OverlayScene<NavKey> {
    override val key: Any = entry.contentKey
    override val entries: List<NavEntry<NavKey>> = listOf(entry)
    override val previousEntries: List<NavEntry<NavKey>> = overlaidEntries

    override val content: @Composable () -> Unit = {
        Box(Modifier.fillMaxSize()) {
            PredictiveBackHandler { backEvents ->
                // The overlay owns system Back while it is the active scene. A cancelled
                // gesture cancels this collector before onBack, preserving the route.
                backEvents.collect { }
                onBack()
            }
            if (kind == SearchOverlayKind.HostDetail) {
                Box(Modifier.fillMaxSize()) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(colorResource(R.color.search_overlay_scrim)),
                    )
                    entry.Content()
                }
            } else {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            awaitPointerEventScope {
                                while (true) {
                                    awaitPointerEvent()
                                }
                            }
                        },
                    color = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurface,
                ) {
                    entry.Content()
                }
            }
        }
    }
}
