package org.trustroots.android.ui.common

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Velocity
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Header state shared by screens with a snappable collapsible hero header.
 */
@Stable
internal class SnappableCollapseHeader internal constructor(
    val connection: NestedScrollConnection,
    private val headerHeightState: State<Dp>,
    private val isCollapsedState: State<Boolean>,
) {
    val headerHeight: Dp get() = headerHeightState.value
    val isCollapsed: Boolean get() = isCollapsedState.value
}

/**
 * Creates a collapsible header state that collapses the header between
 * [expandedHeaderHeight] and [compactHeaderHeight] as the content beneath
 * [SnappableCollapseHeader.connection] scrolls, snapping fully open or closed
 * at the end of each scroll gesture. [key] resets the saved offset, matching
 * the surrounding content, when it changes.
 */
@Composable
internal fun rememberSnappableCollapseHeader(
    expandedHeaderHeight: () -> Dp,
    compactHeaderHeight: () -> Dp,
    key: Any? = Unit,
): SnappableCollapseHeader {
    val currentDensity = rememberUpdatedState(LocalDensity.current)
    val currentExpandedHeaderHeight = rememberUpdatedState(expandedHeaderHeight)
    val currentCompactHeaderHeight = rememberUpdatedState(compactHeaderHeight)
    val scope = rememberCoroutineScope()
    val collapseOffset = rememberSaveable(key) { mutableFloatStateOf(0f) }
    fun maxCollapsePx(): Float =
        with(currentDensity.value) {
            (currentExpandedHeaderHeight.value() - currentCompactHeaderHeight.value()).coerceAtLeast(0.dp).toPx()
        }
    val connection = remember(scope, collapseOffset) {
        object : NestedScrollConnection {
            private var snapJob: Job? = null

            private fun snapTo(target: Float) {
                snapJob?.cancel()
                snapJob = scope.launch {
                    animate(
                        initialValue = collapseOffset.floatValue.coerceIn(0f, maxCollapsePx()),
                        targetValue = target,
                        animationSpec = tween(200),
                    ) { value, _ ->
                        collapseOffset.floatValue = value
                    }
                }
            }

            private fun consume(deltaY: Float): Float {
                snapJob?.cancel()
                snapJob = null
                val max = maxCollapsePx()
                val before = collapseOffset.floatValue.coerceIn(0f, max)
                val after = (before - deltaY).coerceIn(0f, max)
                collapseOffset.floatValue = after
                return before - after
            }

            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset =
                Offset(0f, consume(available.y))

            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource,
            ): Offset = Offset(0f, consume(available.y))

            override suspend fun onPostFling(
                consumed: Velocity,
                available: Velocity,
            ): Velocity {
                val max = maxCollapsePx()
                val settled = collapseOffset.floatValue.coerceIn(0f, max)
                val target = when {
                    available.y < 0f -> max
                    available.y > 0f -> 0f
                    settled >= max / 2f -> max
                    else -> 0f
                }
                if (settled != target) {
                    snapTo(target)
                } else {
                    collapseOffset.floatValue = target
                }
                return available
            }
        }
    }
    val headerHeight = remember(expandedHeaderHeight, compactHeaderHeight, collapseOffset) {
        derivedStateOf {
            (currentExpandedHeaderHeight.value() - with(currentDensity.value) {
                collapseOffset.floatValue.coerceIn(0f, maxCollapsePx()).toDp()
            }).coerceAtLeast(currentCompactHeaderHeight.value())
        }
    }
    val isCollapsed = remember(headerHeight) {
        derivedStateOf { headerHeight.value <= currentCompactHeaderHeight.value() + 1.dp }
    }
    return remember(connection, headerHeight, isCollapsed) {
        SnappableCollapseHeader(connection, headerHeight, isCollapsed)
    }
}
