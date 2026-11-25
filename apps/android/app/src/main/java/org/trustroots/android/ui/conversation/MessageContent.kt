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

internal fun messageContent(content: String, backendURL: String, plainText: String? = null): AnnotatedString {
    val parsed = Html.fromHtml(content, Html.FROM_HTML_MODE_COMPACT)
    val start = parsed.indexOfFirst { !it.isWhitespace() }
    if (start < 0) return AnnotatedString(plainText.orEmpty())
    val end = parsed.indexOfLast { !it.isWhitespace() } + 1
    val base = URI("$backendURL/")
    val links = parsed.getSpans(start, end, URLSpan::class.java).mapNotNull { link ->
        val destination = trustrootsDestination(link.url, base) ?: return@mapNotNull null
        val linkStart = parsed.getSpanStart(link).coerceAtLeast(start)
        val linkEnd = parsed.getSpanEnd(link).coerceAtMost(end)
        Triple(destination, linkStart, linkEnd)
    }
    if (links.isEmpty()) return AnnotatedString(plainText ?: parsed.substring(start, end))

    // Android's HTML parser can change whitespace. Preserve link spans only
    // when their visible characters can be mapped to the server's text.
    val parsedCharacters = (start until end).filterNot { parsed[it].isWhitespace() }
    val serverText = plainText ?: parsed.substring(start, end)
    val plainCharacters = serverText.indices.filterNot { serverText[it].isWhitespace() }
    val useServerText = plainText != null &&
        parsedCharacters.map { parsed[it] } == plainCharacters.map { serverText[it] }

    return buildAnnotatedString {
        append(if (useServerText) serverText else parsed.substring(start, end))
        for ((destination, linkStart, linkEnd) in links) {
            if (useServerText) {
                val coveredCharacters = linkStart until linkEnd
                val first = parsedCharacters.indexOfFirst { it in coveredCharacters }
                if (first < 0) continue
                val next = parsedCharacters.indexOfFirst { it >= linkEnd }
                val last = if (next < 0) parsedCharacters.lastIndex else next - 1
                addLink(LinkAnnotation.Url(destination, linkStyle), plainCharacters[first], plainCharacters[last] + 1)
            } else {
                addLink(LinkAnnotation.Url(destination, linkStyle), linkStart - start, linkEnd - start)
            }
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
