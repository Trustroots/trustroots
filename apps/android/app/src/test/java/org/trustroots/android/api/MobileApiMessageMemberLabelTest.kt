package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiMessageMemberLabelTest {
    @Test fun usesSenderUsernameWhenTheServerHasNoDisplayName() {
        val message = parseMessage(
            JSONObject(
                """{"_id":"message-one","content":"Hello traveller.","userFrom":{"_id":"member-one","username":"steady-heron","displayName":"  "}}""",
            ),
        )

        assertEquals("steady-heron", message.sender.label)
    }

    @Test fun usesGenericMemberLabelWhenTheServerOmitsBothNames() {
        val message = parseMessage(
            JSONObject(
                """{"_id":"message-two","content":"A fictional note.","userFrom":{"_id":"member-two"}}""",
            ),
        )

        assertEquals("Trustroots member", message.sender.label)
    }
}
