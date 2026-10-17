package org.trustroots.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class MemberMessageActionsTest {
    @Test fun missingMemberIDDoesNotSend() {
        val sends = mutableListOf<Pair<String, String>>()

        sendMessageIfReady(null, "A fictional message.", sending = false) { id, content ->
            sends += id to content
        }

        assertEquals(emptyList<Pair<String, String>>(), sends)
    }

    @Test fun emptyOrUnicodeWhitespaceContentDoesNotSend() {
        val sends = mutableListOf<Pair<String, String>>()

        listOf("", " \t\n", "\u2003\u2003").forEach { content ->
            sendMessageIfReady("fictional-member", content, sending = false) { id, message ->
                sends += id to message
            }
        }

        assertEquals(emptyList<Pair<String, String>>(), sends)
    }

    @Test fun sendingInProgressDoesNotDispatchAnotherMessage() {
        val sends = mutableListOf<Pair<String, String>>()

        sendMessageIfReady("fictional-member", "A fictional message.", sending = true) { id, content ->
            sends += id to content
        }

        assertEquals(emptyList<Pair<String, String>>(), sends)
    }

    @Test fun validMessageDispatchesOnceWithOriginalContent() {
        val sends = mutableListOf<Pair<String, String>>()
        val content = "  A fictional message.\n "

        sendMessageIfReady("fictional-member", content, sending = false) { id, message ->
            sends += id to message
        }

        assertEquals(listOf("fictional-member" to content), sends)
    }
}
