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
            "http://[",
            " ",
        )) {
            val message = messageContent("<a href=\"$destination\">Visible label</a>", backend)
            assertEquals("Visible label", message.text)
            assertTrue(destination, message.getLinkAnnotations(0, message.length).isEmpty())
        }
        assertEquals("", messageContent("<p> </p>", backend).text)
    }
}
