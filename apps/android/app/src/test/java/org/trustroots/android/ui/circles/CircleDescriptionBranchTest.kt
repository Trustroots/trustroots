package org.trustroots.android.ui.circles

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CircleDescriptionBranchTest {
    @Test
    fun selfClosingBlockedTagsDoNotHideFollowingText() {
        val rendered = circleDescription("<script/>Visible after the empty script element")

        assertTrue(rendered.text.contains("Visible after the empty script element"))
    }

    @Test
    fun malformedMarkupInsideBlockedContentStaysHidden() {
        val rendered = circleDescription("<script>< plain >hidden text</script>Visible text")

        assertFalse(rendered.text.contains("plain"))
        assertFalse(rendered.text.contains("hidden text"))
        assertTrue(rendered.text.contains("Visible text"))
    }

    @Test
    fun listItemOutsideAListRemainsPlainTextWithoutAListMarker() {
        val rendered = circleDescription("<li>Loose item</li>")

        assertTrue(rendered.text.contains("Loose item"))
        assertFalse(rendered.text.contains("•"))
    }

    @Test
    fun nestedQuotesShowDepthMarkersAndUnmatchedBlockedClosersLeaveTextVisible() {
        val nestedQuote = circleDescription(
            "<blockquote>Outer <blockquote>Inner quote</blockquote>Outer again</blockquote>",
        )
        val unmatchedCloser = circleDescription("</script>Visible after unmatched closer")

        assertTrue(nestedQuote.text.contains("┃ ┃ Inner quote"))
        assertTrue(nestedQuote.text.contains("┃ Outer again"))
        assertTrue(unmatchedCloser.text.contains("Visible after unmatched closer"))
    }
}
