package org.trustroots.android.ui.inbox

import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class MessageNavigationSerializationTest {
    @Test
    fun messageRoutesSerializeOnlyTheirSafeDestinationIdentity() {
        val cookie = "connect.sid=fictional-cookie-secret"
        val inbox = Json.encodeToString(MessageInboxVisit.serializer(), MessageInboxVisit(17L))
        val conversation = Json.encodeToString(
            MessageConversationVisit.serializer(),
            MessageConversationVisit("member-owl", 18L),
        )
        val profile = Json.encodeToString(
            MessageProfileVisit.serializer(),
            MessageProfileVisit("quiet-fox", 19L),
        )

        assertEquals("""{"visitID":17}""", inbox)
        assertEquals("""{"memberID":"member-owl","visitID":18}""", conversation)
        assertEquals("""{"username":"quiet-fox","visitID":19}""", profile)
        assertEquals(
            MessageInboxVisit(17L),
            Json.decodeFromString(MessageInboxVisit.serializer(), inbox),
        )
        assertEquals(
            MessageConversationVisit("member-owl", 18L),
            Json.decodeFromString(MessageConversationVisit.serializer(), conversation),
        )
        assertEquals(
            MessageProfileVisit("quiet-fox", 19L),
            Json.decodeFromString(MessageProfileVisit.serializer(), profile),
        )
        assertFalse(inbox.contains(cookie))
        assertFalse(conversation.contains(cookie))
        assertFalse(profile.contains(cookie))
    }
}
