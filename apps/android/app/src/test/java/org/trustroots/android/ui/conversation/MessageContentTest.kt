package org.trustroots.android.ui.conversation

import androidx.compose.ui.text.LinkAnnotation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MessageContentTest {
    private val backend = "https://preview.example"

    @Test fun trustrootsLinksKeepTheirLabelsAndResolveAgainstTheBackend() {
        val message = messageContent(
            """
            <p><a href="HTTPS://trustroots.org/faq"><b>FAQ</b></a>,
            <a href="//nested.team.trustroots.org/apps?a=1&amp;b=2">Apps</a>,
            <a href="/safety">Safety</a>,
            <a href="https://preview.example:443/rules">Rules</a></p>
            """.trimIndent(),
            backend,
        )
        assertEquals(
            mapOf(
                "FAQ" to "https://trustroots.org/faq",
                "Apps" to "https://nested.team.trustroots.org/apps?a=1&b=2",
                "Safety" to "https://preview.example/safety",
                "Rules" to "https://preview.example:443/rules",
            ),
            message.getLinkAnnotations(0, message.length).associate {
                message.text.substring(it.start, it.end) to (it.item as LinkAnnotation.Url).url
            },
        )
    }

    @Test fun externalAndInvalidDestinationsStayInert() {
        for (destination in listOf(
            "https://outside.example/",
            "https://trustroots.org.outside.example/",
            "https://trustroots.org@outside.example/",
            "http://preview.example/",
            "https://preview.example:8443/",
            "ftp://team.trustroots.org/",
            "https:opaque",
            "http://[",
            " ",
        )) {
            val message = messageContent("<a href=\"$destination\">Visible label</a>", backend)
            assertEquals("Visible label", message.text)
            assertTrue(destination, message.getLinkAnnotations(0, message.length).isEmpty())
        }
        assertEquals("", messageContent("<p> </p>", backend).text)
    }

    @Test fun whitespaceIsTrimmedWithoutMovingLinkLabels() {
        val message = messageContent("&nbsp;<a href=\"/safety\">Safety</a>&nbsp;", backend)

        assertEquals("Safety", message.text)
        val link = message.getLinkAnnotations(0, message.length).single()
        assertEquals("Safety", message.text.substring(link.start, link.end))
    }

    @Test fun relativeDestinationsNeedAnAbsoluteBackend() {
        val message = messageContent("<a href=\"/safety\">Safety</a>", "preview")

        assertEquals("Safety", message.text)
        assertTrue(message.getLinkAnnotations(0, message.length).isEmpty())
    }

    @Test fun serverLineBreaksKeepTrustrootsLinksOnTheirLabels() {
        val serverText = "First\n\nSafety"
        val message = messageContent(
            "<div>First</div><div><br></div><div><a href=\"/safety\">Safety</a></div>",
            backend,
            serverText,
        )

        assertEquals(serverText, message.text)
        val link = message.getLinkAnnotations(0, message.length).single()
        assertEquals("Safety", message.text.substring(link.start, link.end))
        assertEquals("https://preview.example/safety", (link.item as LinkAnnotation.Url).url)
    }

    @Test fun serverTextIsUsedForBlankHtmlAndMessagesWithoutLinks() {
        val serverText = "First\n\nSecond"

        assertEquals(serverText, messageContent("<p><br></p>", backend, serverText).text)
        assertEquals(serverText, messageContent("<p>First</p><p>Second</p>", backend, serverText).text)
    }

    @Test fun differentServerTextKeepsTheHtmlLinkLabel() {
        val message = messageContent("<a href=\"/safety\">Safety</a>", backend, "Different")

        assertEquals("Safety", message.text)
        val link = message.getLinkAnnotations(0, message.length).single()
        assertEquals("Safety", message.text.substring(link.start, link.end))
        assertEquals("https://preview.example/safety", (link.item as LinkAnnotation.Url).url)
    }

    @Test fun linksWithOnlyWhitespaceHaveNoLabelInServerText() {
        val html = "Before<a href=\"/safety\">&nbsp;</a>after <a href=\"/faq\">FAQ</a>!"
        val legacy = messageContent(html, backend)
        assertEquals(2, legacy.getLinkAnnotations(0, legacy.length).size)

        val message = messageContent(html, backend, "Before\nafter FAQ!")

        assertEquals("Before\nafter FAQ!", message.text)
        val link = message.getLinkAnnotations(0, message.length).single()
        assertEquals("FAQ", message.text.substring(link.start, link.end))
        assertEquals("https://preview.example/faq", (link.item as LinkAnnotation.Url).url)
    }

    @Test fun explicitDefaultHttpPortMatchesTheBackend() {
        val message = messageContent(
            "<a href=\"http://preview.example:80/safety\">Safety</a>",
            "http://preview.example",
        )

        val link = message.getLinkAnnotations(0, message.length).single()
        assertEquals("http://preview.example:80/safety", (link.item as LinkAnnotation.Url).url)
    }
}
