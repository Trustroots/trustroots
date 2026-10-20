package org.trustroots.android.ui

import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class CircleDescriptionTest {
    @Test fun keepsParagraphListsInlineFormattingAndQuotes() {
        val rendered = circleDescription(
            "<p>Welcome<br><strong>bold</strong> and <em>emphasised</em> <u>underlined</u>.</p>" +
                "<ul><li>First item</li><li>Second item</li></ul><blockquote>A quiet quote</blockquote>",
        )

        assertTrue(rendered.text.contains("Welcome\nbold and emphasised underlined."))
        assertTrue(rendered.text.contains("First item"))
        assertTrue(rendered.text.contains("Second item"))
        assertTrue(rendered.text.contains("A quiet quote"))
        assertTrue(rendered.spanStyles.any { it.item.fontWeight == FontWeight.Bold })
        assertTrue(rendered.spanStyles.any { it.item.fontStyle == FontStyle.Italic })
        assertTrue(rendered.spanStyles.any { it.item.textDecoration == TextDecoration.Underline })
    }

    @Test fun showsLinkLabelWithoutCreatingClickableAnnotation() {
        val rendered = circleDescription("<p>Read <a href='https://example.invalid/'>the guidance</a>.</p>")

        assertEquals("Read the guidance.", rendered.text.trim())
        assertTrue(rendered.getStringAnnotations(start = 0, end = rendered.length).isEmpty())
    }

    @Test fun trimsPlatformAddedOuterWhitespaceAndKeepsInlineSpans() {
        val rendered = circleDescription("<p> <strong>Bold only</strong> </p>")

        assertEquals("Bold only", rendered.text)
        assertTrue(rendered.spanStyles.any { it.item.fontWeight == FontWeight.Bold })
    }

    @Test fun ignoresQuotedTagDelimitersAndRetainsMalformedPlainTextSafely() {
        val quoted = circleDescription("<a title=\"1 > 0\">the label</a>")
        val malformed = circleDescription("Before < this remains readable")
        val spacedAngle = circleDescription("Before < not a tag > after")
        val unclosedComment = circleDescription("Visible <!-- hidden to end")

        assertEquals("the label", quoted.text.trim())
        assertEquals("Before < this remains readable", malformed.text)
        assertEquals("Before < not a tag > after", spacedAngle.text)
        assertEquals("Visible", unclosedComment.text)
    }

    @Test fun recoversAtAnOuterBlockedTagWhenBlockedTagsAreMismatched() {
        val rendered = circleDescription("<script><style>hidden</script>visible</style>")

        assertEquals("visible", rendered.text.trim())
    }

    @Test fun preservesNestedParagraphListAndEmphasisStructureAndEntityText() {
        val rendered = circleDescription(
            "<p>Outer <strong>bold <em>bold italic</em></strong></p>" +
                "<ul><li>First &amp; foremost<ul><li>Nested item</li></ul></li></ul><p>Last<br>line</p>",
        )
        val boldRange = rendered.spanStyles.firstOrNull { it.item.fontWeight == FontWeight.Bold }
        val italicRange = rendered.spanStyles.firstOrNull { it.item.fontStyle == FontStyle.Italic }

        assertTrue(rendered.text.contains("Outer bold bold italic"))
        assertTrue(rendered.text.contains("First & foremost"))
        assertTrue(rendered.text.contains("Nested item"))
        assertTrue(rendered.text.contains("Last"))
        assertTrue(rendered.text.contains("line"))
        assertTrue(boldRange != null)
        assertTrue(italicRange != null)
        assertTrue(rendered.text.substring(boldRange!!.start, boldRange.end).contains("bold italic"))
        assertEquals("bold italic", rendered.text.substring(italicRange!!.start, italicRange.end))
        assertEquals(rendered.text, circleDescriptionText(
            "<p>Outer <strong>bold <em>bold italic</em></strong></p>" +
                "<ul><li>First &amp; foremost<ul><li>Nested item</li></ul></li></ul><p>Last<br>line</p>",
        ))
    }

    @Test fun preservesListMarkersAndQuoteParagraphStructure() {
        val list = circleDescription("<ul><li>First</li><li>Second</li></ul>")
        val nestedList = circleDescription("<ul><li>Outer<ul><li>Inner</li></ul></li></ul>")
        val quote = circleDescription("<blockquote>Quote only</blockquote>")
        val quoteParagraph = circleDescription("<blockquote><p>Quoted words</p></blockquote><p>After</p>")
        val listThenText = circleDescription("<ul><li>First</li></ul>After")

        assertTrue("Expected visible unordered-list markers in ${list.text}", list.text.contains('•'))
        assertTrue(nestedList.text.contains("• Outer"))
        assertTrue(nestedList.text.contains("◦ Inner"))
        assertEquals("┃ Quote only", quote.text.trim())
        assertTrue("Expected quote marker attached to its paragraph: ${quoteParagraph.text}", quoteParagraph.text.contains("┃ Quoted words"))
        assertTrue("Expected a boundary after the list: ${listThenText.text}", Regex("First\\s+After").containsMatchIn(listThenText.text))
    }

    @Test fun removesUnsupportedActiveContentAndKeepsSupportedContentInsideUnknownWrappers() {
        val rendered = circleDescription(
            "<div><strong>Visible</strong></div><script>alert('hidden')</script>" +
                "<style>.secret { display: none }</style><img src='https://example.invalid/image.png'>" +
                "<iframe>embedded secret</iframe>",
        )

        assertTrue(rendered.text.contains("Visible"))
        assertFalse(rendered.text.contains("alert"))
        assertFalse(rendered.text.contains("secret"))
        assertFalse(rendered.text.contains("image.png"))
    }

    @Test fun circleFilterTextMatchesVisibleDescriptionAndExcludesRemovedContent() {
        val text = circleDescriptionText(
            "<p>Coastal <b>walkers</b></p><script>hidden-keyword</script>",
        )

        assertTrue(text.contains("Coastal walkers"))
        assertFalse(text.contains("hidden-keyword"))
    }
}
