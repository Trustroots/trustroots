package org.trustroots.android.ui.conversation

import android.text.Html
import android.text.style.URLSpan
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import java.net.URI
import java.net.URISyntaxException
import org.trustroots.android.BuildConfig

private val linkStyle = TextLinkStyles(style = SpanStyle(textDecoration = TextDecoration.Underline))

internal fun messageContent(content: String, backendURL: String): AnnotatedString {
    val parsed = Html.fromHtml(content, Html.FROM_HTML_MODE_COMPACT)
    val start = parsed.indexOfFirst { !it.isWhitespace() }
    if (start < 0) return AnnotatedString("")
    val end = parsed.indexOfLast { !it.isWhitespace() } + 1
    val base = URI("$backendURL/")

    return buildAnnotatedString {
        append(parsed.substring(start, end))
        for (link in parsed.getSpans(start, end, URLSpan::class.java)) {
            val destination = trustrootsDestination(link.url, base) ?: continue
            addLink(
                LinkAnnotation.Url(destination, linkStyle),
                parsed.getSpanStart(link).coerceAtLeast(start) - start,
                parsed.getSpanEnd(link).coerceAtMost(end) - start,
            )
        }
    }
}

private fun trustrootsDestination(href: String, base: URI): String? {
    if (href.isBlank()) return null
    val destination = try {
        base.resolve(URI(href.trim()))
    } catch (_: URISyntaxException) {
        return null
    }
    val scheme = destination.scheme?.lowercase() ?: return null
    if (scheme !in BuildConfig.TRUSTROOTS_LINK_SCHEMES) return null
    val host = destination.host?.lowercase() ?: return null
    val sameOrigin = host.equals(base.host, ignoreCase = true) &&
        scheme.equals(base.scheme, ignoreCase = true) && destination.httpPort() == base.httpPort()
    val domain = BuildConfig.TRUSTROOTS_LINK_DOMAIN
    return if (sameOrigin || host == domain || host.endsWith(".$domain")) {
        "$scheme:${destination.toASCIIString().substringAfter(':')}"
    } else {
        null
    }
}

private fun URI.httpPort(): Int =
    port.takeIf { it != -1 } ?: if (scheme.equals("https", ignoreCase = true)) 443 else 80
