package org.trustroots.android.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test
import org.trustroots.android.ui.common.topInset
import org.trustroots.android.ui.common.bottomInset

class ScreenInsetsTest {
    @Test fun extractsTopAndBottomWithoutCopyingOtherEdges() {
        val padding = PaddingValues(start = 13.dp, top = 29.dp, end = 41.dp, bottom = 97.dp)
        val top = padding.topInset()
        val bottom = padding.bottomInset()
        assertEquals(29.dp, top.calculateTopPadding())
        assertEquals(0.dp, top.calculateBottomPadding())
        assertEquals(0.dp, bottom.calculateTopPadding())
        assertEquals(97.dp, bottom.calculateBottomPadding())
        for (direction in LayoutDirection.entries) {
            assertEquals(0.dp, top.calculateLeftPadding(direction))
            assertEquals(0.dp, top.calculateRightPadding(direction))
            assertEquals(0.dp, bottom.calculateLeftPadding(direction))
            assertEquals(0.dp, bottom.calculateRightPadding(direction))
        }
    }

    @Test fun zeroInsetsStayZero() {
        for (padding in listOf(PaddingValues.Zero.topInset(), PaddingValues.Zero.bottomInset())) {
            assertEquals(0.dp, padding.calculateTopPadding())
            assertEquals(0.dp, padding.calculateBottomPadding())
            assertEquals(0.dp, padding.calculateLeftPadding(LayoutDirection.Ltr))
            assertEquals(0.dp, padding.calculateRightPadding(LayoutDirection.Ltr))
        }
    }
}
