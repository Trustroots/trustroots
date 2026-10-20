package org.trustroots.android.ui

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.fromHtml

/** Renders the safe formatting supported by the web circle description. User links stay inert. */
internal fun circleDescription(content: String): AnnotatedString =
    AnnotatedString.fromHtml(sanitiseCircleDescription(content)).trimWhitespace()

/** Plain text used by circle discovery filtering, kept in step with what the detail screen shows. */
internal fun circleDescriptionText(content: String): String = circleDescription(content).text

private val allowedTags = setOf("p", "br", "b", "i", "em", "strong", "u")
private val contentBlockingTags = setOf("script", "style", "iframe", "svg", "math", "object", "template")
private val listMarkers = listOf("•", "◦", "▪")

private fun AnnotatedString.trimWhitespace(): AnnotatedString {
    val start = text.indexOfFirst { !it.isWhitespace() }
    if (start < 0) return AnnotatedString("")
    val end = text.indexOfLast { !it.isWhitespace() } + 1
    return subSequence(start, end)
}

private fun sanitiseCircleDescription(content: String): String {
    val output = StringBuilder(content.length)
    val blocked = ArrayDeque<String>()
    var listDepth = 0
    var quoteDepth = 0
    var quotePrefixPending = false
    var index = 0
    while (index < content.length) {
        if (content[index] != '<') {
            if (blocked.isEmpty()) {
                if (quotePrefixPending) {
                    output.append("┃ ".repeat(quoteDepth))
                    quotePrefixPending = false
                }
                output.append(content[index])
            }
            index++
            continue
        }

        if (content.startsWith("<!--", index)) {
            val commentEnd = content.indexOf("-->", index + 4)
            if (commentEnd < 0) break
            index = commentEnd + 3
            continue
        }

        val end = findTagEnd(content, index + 1)
        if (end < 0) {
            if (blocked.isEmpty()) output.append("&lt;")
            index++
            continue
        }
        val token = content.substring(index + 1, end)
        val parsedTag = tagPattern.find(token)
        if (parsedTag == null) {
            if (blocked.isEmpty()) output.append("&lt;")
            index++
            continue
        }
        val closing = parsedTag.groupValues[1] == "/"
        val tag = parsedTag.groupValues[2].lowercase()
        val selfClosing = token.trimEnd().endsWith('/')
        if (tag in contentBlockingTags) {
            if (closing) {
                // Recover from misnested markup by closing the matching blocked subtree and
                // anything malformed inside it, as an HTML parser would at this boundary.
                val matchingIndex = blocked.indexOfLast { it == tag }
                if (matchingIndex >= 0) repeat(blocked.size - matchingIndex) { blocked.removeLast() }
            } else if (!selfClosing) {
                blocked.addLast(tag)
            }
        } else if (blocked.isEmpty()) {
            when {
                tag == "ul" -> {
                    if (closing) {
                        listDepth = (listDepth - 1).coerceAtLeast(0)
                        output.append("<br>")
                    }
                    else listDepth++
                }
                tag == "li" && !closing && listDepth > 0 -> {
                    val marker = listMarkers[(listDepth - 1).coerceAtMost(listMarkers.lastIndex)]
                    output.append("<br>$marker ")
                }
                tag == "blockquote" -> {
                    if (closing) {
                        quoteDepth = (quoteDepth - 1).coerceAtLeast(0)
                        quotePrefixPending = quoteDepth > 0
                        output.append("<br>")
                    } else {
                        quoteDepth++
                        quotePrefixPending = true
                        output.append("<br>")
                    }
                }
                tag == "p" && !closing && quoteDepth > 0 -> {
                    quotePrefixPending = true
                    output.append("<p>")
                }
                tag == "p" && closing && quoteDepth > 0 -> output.append("</p>")
                tag in allowedTags -> {
                    if (tag == "br") output.append("<br>")
                    else if (closing) output.append("</$tag>")
                    else output.append("<$tag>")
                }
            }
        }
        index = end + 1
    }
    return output.toString()
}

private val tagPattern = Regex("^(/?)([A-Za-z][A-Za-z0-9:-]*)\\b")

/** Finds a tag boundary without treating `>` inside a quoted attribute as the end. */
private fun findTagEnd(content: String, start: Int): Int {
    var quote: Char? = null
    for (index in start until content.length) {
        val character = content[index]
        if (quote != null) {
            if (character == quote) quote = null
        } else when (character) {
            '\'', '"' -> quote = character
            '>' -> return index
        }
    }
    return -1
}
