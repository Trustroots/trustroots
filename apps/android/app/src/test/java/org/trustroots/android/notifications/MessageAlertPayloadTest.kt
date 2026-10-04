package org.trustroots.android.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MessageAlertPayloadTest {
    @Test fun acceptsOnlyAConversationSenderId() {
        val sender = "507f1f77bcf86cd799439011"
        assertEquals(sender, senderIdFromPushPayload("""{"senderId":"$sender"}"""))
        assertNull(senderIdFromPushPayload("""{"senderId":"../other"}"""))
        assertNull(senderIdFromPushPayload("{\"senderId\":\"$sender\",\"content\":\"ignored\""))
        assertNull(senderIdFromPushPayload("not JSON"))
    }
}
