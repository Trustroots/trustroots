package org.trustroots.android.ui.common

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalLayoutDirection

/**
 * Helpers to take the individual components of a [PaddingValues] (as passed down from
 * the shared Scaffold in MemberShell) and let each screen apply them judiciously:
 * status-bar inset at the top, navigation-bar height at the bottom, and display
 * cutout insets horizontally where appropriate.
 */

internal fun PaddingValues.topInset(): PaddingValues = PaddingValues(top = calculateTopPadding())

internal fun PaddingValues.bottomInset(): PaddingValues = PaddingValues(bottom = calculateBottomPadding())

/** The horizontal (start + end) part of the inset, as padding for list items or content columns. */
@Composable
internal fun PaddingValues.horizontalInset(): PaddingValues {
    val layoutDirection = LocalLayoutDirection.current
    return PaddingValues(
        start = calculateStartPadding(layoutDirection),
        end = calculateEndPadding(layoutDirection),
    )
}
