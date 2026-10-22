package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MobileApiMessageMemberLabelTest {
    @Test fun preservesUsernameWithoutSynthesisingALabelWhenDisplayNameIsBlank() {
        val message = parseMessage(
            JSONObject(
                """{"_id":"message-one","content":"Hello traveller.","userFrom":{"_id":"member-one","username":"steady-heron","displayName":"  "}}""",
            ),
        )

        assertEquals("steady-heron", message.sender.username)
        assertEquals("", message.sender.displayName)
    }

    @Test fun leavesUnknownMemberLabelResolutionToTheUi() {
        val message = parseMessage(
            JSONObject(
                """{"_id":"message-two","content":"A fictional note.","userFrom":{"_id":"member-two"}}""",
            ),
        )

        assertNull(message.sender.username)
        assertEquals("", message.sender.displayName)
    }
}
