package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class NostrootsNotesTest {
    @Test fun parsesMapNoteAndOpenLocationCode() {
        val event = """["EVENT","map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A friendly gathering","tags":[["l","8FVC9G8F+5W","open-location-code"]]}]"""
        val note = parseCommunityNote(event)
        assertNotNull(note)
        assertEquals("A friendly gathering", note?.content)
        assertEquals(1700000000000L, note?.createdAt)
        assertNotNull(decodeOpenLocationCode("8FVC9G8F+5W"))
    }

    @Test fun ignoresEventsWithoutValidLocationOrKind() {
        val event = """["EVENT","map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30398,"content":"A note","tags":[["l","bad","open-location-code"]]}]"""
        assertNull(parseCommunityNote(event))
        assertNull(decodeOpenLocationCode("bad"))
    }
}
